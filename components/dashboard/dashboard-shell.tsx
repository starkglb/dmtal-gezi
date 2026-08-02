'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Siren, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { rolePermissions } from '@/lib/labels';
import { emergencyTypeLabels } from '@/lib/labels';
import { EmergencyType } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface DashboardShellProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export function DashboardShell({ children, requiredPermission }: DashboardShellProps) {
  const router = useRouter();
  const { user, loading, can } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeEmergency, setActiveEmergency] = useState<any | null>(null);
  const [showEmergencyPopup, setShowEmergencyPopup] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // Check for active emergencies
  useEffect(() => {
    if (!user) return;
    let interval: ReturnType<typeof setInterval>;

    const checkEmergency = async () => {
      const { data } = await supabase
        .from('emergencies')
        .select('*, trips(name)')
        .in('status', ['aktif', 'mudahale_ediliyor'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const wasNull = !activeEmergency;
        setActiveEmergency(data);
        // Show popup if new emergency detected
        if (wasNull) {
          setShowEmergencyPopup(true);
        }
      } else {
        setActiveEmergency(null);
      }
    };

    checkEmergency();
    interval = setInterval(checkEmergency, 15000); // Check every 15 seconds

    // Listen for service worker push messages
    const handleEmergencyNotification = () => {
      setShowEmergencyPopup(true);
      checkEmergency();
    };
    window.addEventListener('emergency-notification', handleEmergencyNotification);

    return () => {
      clearInterval(interval);
      window.removeEventListener('emergency-notification', handleEmergencyNotification);
    };
  }, [user, activeEmergency]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) return null;

  if (requiredPermission && !can(requiredPermission)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Erişim Yetkiniz Yok</h2>
          <p className="mt-2 text-sm text-slate-500">
            Bu sayfayı görüntülemek için gerekli yetkiye sahip değilsiniz. Yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Active emergency banner */}
        {activeEmergency && (
          <div
            className={cn(
              'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-white transition',
              activeEmergency.status === 'aktif' ? 'bg-rose-600' : 'bg-amber-500'
            )}
            onClick={() => router.push('/dashboard/acil-durum')}
          >
            <Siren className="h-5 w-5 animate-pulse" />
            <div className="flex-1">
              <span className="font-bold">🚨 AKTİF ACİL DURUM</span>
              <span className="ml-2 text-sm opacity-90">
                {emergencyTypeLabels[activeEmergency.emergency_type as EmergencyType]}
                {activeEmergency.trips?.name ? ` — ${activeEmergency.trips.name}` : ''}
              </span>
            </div>
            <span className="text-xs underline">Detayları görüntülemek için tıklayın</span>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Emergency popup overlay */}
      {showEmergencyPopup && activeEmergency && (
        <EmergencyPopup
          emergency={activeEmergency}
          onDismiss={() => setShowEmergencyPopup(false)}
          onView={() => {
            setShowEmergencyPopup(false);
            router.push('/dashboard/acil-durum');
          }}
        />
      )}
    </div>
  );
}

function EmergencyPopup({ emergency, onDismiss, onView }: { emergency: any; onDismiss: () => void; onView: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-rose-600 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <Siren className="h-7 w-7 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold">🚨 ACİL DURUM</h2>
              <p className="text-sm text-rose-100">GEZİYÖNET — Acil Durum Bildirimi</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="space-y-2 text-sm">
            <p><span className="text-slate-500">Acil Durum:</span> <span className="font-semibold text-slate-800">{emergencyTypeLabels[emergency.emergency_type as EmergencyType]}</span></p>
            {emergency.trips?.name && <p><span className="text-slate-500">Gezi:</span> <span className="font-medium text-slate-700">{emergency.trips.name}</span></p>}
            {emergency.location && <p><span className="text-slate-500">Konum:</span> <span className="font-medium text-slate-700">{emergency.location}</span></p>}
            {emergency.description && <p className="rounded-lg bg-slate-50 p-3 text-slate-600">{emergency.description}</p>}
            <p className="text-xs text-slate-400">Başlatılma: {formatDateTime(emergency.created_at)}</p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={onView}
              className="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Detayları Gör
            </button>
            <button
              onClick={onDismiss}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Gördüm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { rolePermissions };
