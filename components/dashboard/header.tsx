'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search, Bell, LogOut, ChevronDown, User, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { roleLabels } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { Reminder } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('reminders')
        .select('*')
        .eq('status', 'okunmadi')
        .order('reminder_date', { ascending: true })
        .limit(10);
      if (data) setReminders(data as Reminder[]);
    })();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/dashboard/katilimcilar?q=${encodeURIComponent(search.trim())}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md lg:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={handleSearch} className="relative hidden flex-1 max-w-md sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Katılımcı ara..."
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <Bell className="h-5 w-5" />
            {reminders.length > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {reminders.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Hatırlatmalar</h3>
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {reminders.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">Yeni hatırlatma yok</p>
                ) : (
                  reminders.map((r) => (
                    <div key={r.id} className="border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50">
                      <p className="text-sm font-medium text-slate-700">{r.title}</p>
                      {r.description && <p className="mt-0.5 text-xs text-slate-500">{r.description}</p>}
                      <p className="mt-1 text-xs text-slate-400">{formatDate(r.reminder_date)}</p>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => { setNotifOpen(false); router.push('/dashboard/hatirlatmalar'); }}
                className="block w-full border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-blue-600 hover:bg-slate-50"
              >
                Tümünü Gör
              </button>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-slate-700">{user?.full_name}</p>
              <p className="text-xs text-slate-500">{user ? roleLabels[user.role] : ''}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{user?.full_name}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={() => { setProfileOpen(false); router.push('/dashboard/sorumlular'); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                <User className="h-4 w-4" /> Profilim
              </button>
              <button
                onClick={() => { setProfileOpen(false); router.push('/dashboard/ayarlar'); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                <SettingsIcon className="h-4 w-4" /> Ayarlar
              </button>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" /> Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
