'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { SystemUser, UserRole } from './types';
import { rolePermissions } from './labels';

interface AuthContextValue {
  user: SystemUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  can: (permission: string) => boolean;
  isMainAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SystemUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('system_users')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      console.error('Kullanıcı profili yüklenemedi:', error.message);
      return null;
    }
    return data as SystemUser | null;
  }, []);

  const refreshUser = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      const profile = await loadUser(currentSession.user.id);
      setUser(profile);
    } else {
      setUser(null);
    }
  }, [loadUser]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(initialSession);
      if (initialSession?.user) {
        const profile = await loadUser(initialSession.user.id);
        if (!mounted) return;
        setUser(profile);
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        (async () => {
          const profile = await loadUser(newSession.user.id);
          if (mounted) setUser(profile);
        })();
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: translateAuthError(error.message) };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      const perms = rolePermissions[user.role] || [];
      return perms.includes(permission);
    },
    [user]
  );

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signIn,
    signOut,
    refreshUser,
    can,
    isMainAdmin: user?.role === 'ana_yonetici',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-posta veya şifre hatalı.';
  if (m.includes('email not confirmed')) return 'E-posta adresiniz henüz onaylanmamış.';
  if (m.includes('user not found')) return 'Kullanıcı bulunamadı.';
  if (m.includes('rate limit')) return 'Çok fazla deneme yapıldı. Lütfen bekleyin.';
  if (m.includes('network')) return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
  return message;
}

export { rolePermissions };
export type { UserRole };
