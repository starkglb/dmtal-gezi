'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, Bus, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

// Ana yönetici var mı kontrol et
useEffect(() => {
  const checkAdmin = async () => {
    const { count, error } = await supabase
      .from('system_users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'ana_yonetici')
      .eq('is_active', true);

    if (error) {
      console.error('Admin kontrol hatası:', error);
      setMode('login');
      return;
    }

    if ((count ?? 0) === 0) {
      setMode('setup');
    } else {
      setMode('login');
    }
  };

  checkAdmin();
}, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Giriş başarılı. Yönlendiriliyorsunuz...');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);
    if (!setupName || !setupEmail || !setupPassword) {
      setSetupError('Lütfen tüm alanları doldurun.');
      return;
    }
    if (setupPassword.length < 6) {
      setSetupError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    setSetupLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: setupEmail,
        password: setupPassword,
      });
      if (authError) {
        setSetupError(authError.message);
        setSetupLoading(false);
        return;
      }
      if (authData.user) {
        const { error: profileError } = await supabase.from('system_users').insert({
          id: authData.user.id,
          email: setupEmail,
          full_name: setupName,
          role: 'ana_yonetici',
          is_active: true,
        });
        if (profileError) {
          setSetupError('Profil oluşturulurken hata: ' + profileError.message);
          setSetupLoading(false);
          return;
        }
        toast.success('Ana yönetici hesabı oluşturuldu. Giriş yapabilirsiniz.');
        setMode('login');
        setEmail(setupEmail);
        setPassword('');
        setSetupName('');
        setSetupEmail('');
        setSetupPassword('');
      }
    } catch (err: any) {
      setSetupError(err.message || 'Beklenmeyen bir hata oluştu.');
    }
    setSetupLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left panel - branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <Bus className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">DMTAL Gezi Yönetim Sistemi</h1>
            <p className="text-sm text-blue-200">Dörtçelik Mesleki ve Teknik Anadolu Lisesi</p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold leading-tight">
            Okul gezi organizasyonlarınızı<br />tek panelden yönetin
          </h2>
          <p className="max-w-md text-blue-100">
            Geziler, katılımcılar, otobüsler, koltuk düzeni, yemek organizasyonları,
            ödemeler, yoklama ve raporları tek yerden professionally yönetin.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { label: 'Gezi Yönetimi', desc: 'Taslaktan tamamlamaya' },
              { label: 'Koltuk Düzeni', desc: 'Türkiye tipi otobüs' },
              { label: 'Ödeme Sistemi', desc: 'Gezi + yemek ayrı' },
              { label: 'PDF Raporlar', desc: 'Tek tıkla çıktı' },
            ].map((f) => (
              <div key={f.label} className="rounded-lg bg-white/5 p-4 backdrop-blur">
                <p className="font-semibold">{f.label}</p>
                <p className="mt-1 text-sm text-blue-200">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-blue-300">© {new Date().getFullYear()} DMTAL Gezi Yönetim Sistemi — Tüm hakları saklıdır.</p>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Bus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">DMTAL Gezi Yönetim Sistemi</h1>
              <p className="text-xs text-slate-500">Okul Gezi Yönetim Sistemi</p>
            </div>
          </div>

          {mode === 'setup' ? (
            <div>
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h2 className="font-semibold text-amber-800">İlk Kurulum</h2>
                <p className="mt-1 text-sm text-amber-700">
                  Sisteme kayıtlı yönetici bulunamadı. Ana yönetici hesabını oluşturarak başlayın.
                </p>
              </div>
              <form onSubmit={handleSetup} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Ad Soyad</label>
                  <input
                    type="text"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Adınız Soyadınız"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">E-posta</label>
                  <input
                    type="email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="ornek@okul.edu.tr"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Şifre</label>
                  <input
                    type="password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="En az 6 karakter"
                  />
                </div>
                {setupError && <p className="text-sm text-rose-600">{setupError}</p>}
                <button
                  type="submit"
                  disabled={setupLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {setupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Ana Yönetici Hesabını Oluştur
                </button>
              </form>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Yönetici Girişi</h2>
              <p className="mt-1.5 text-sm text-slate-500">Devam etmek için giriş yapın</p>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">E-posta</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="ornek@okul.edu.tr"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Şifre</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
