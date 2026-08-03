'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Siren, Volume2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { rolePermissions, emergencyTypeLabels } from '@/lib/labels';
import { EmergencyType } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { useEmergencyAlarm } from '@/hooks/use-emergency-alarm';
import { cn } from '@/lib/utils';

interface DashboardShellProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

// Track which emergency IDs we've already shown the full-screen alert for
// (persisted across re-renders but not across page reloads)
const shownEmergencyIds = new Set<string>();

export function DashboardShell({ children, requiredPermission }: DashboardShellProps) {
  const router = useRouter();
  const { user, loading, can } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeEmergency, setActiveEmergency] = useState<any | null>(null);
  const [showEmergencyOverlay, setShowEmergencyOverlay] = useState(false);
  const [alarmEnabledPrompt, setAlarmEnabledPrompt] = useState(false);
  const alarm = useEmergencyAlarm();
  const lastEmergencyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // Check if alarm was previously enabled — if not, show the enable prompt on first load
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem('emergency_alarm_enabled');
    if (stored !== 'true') {
      setAlarmEnabledPrompt(true);
    }
  }, [user]);

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
        const isNewEmergency = data.id !== lastEmergencyRef.current && !shownEmergencyIds.has(data.id);
        setActiveEmergency(data);

        if (isNewEmergency) {
          shownEmergencyIds.add(data.id);
          lastEmergencyRef.current = data.id;
          setShowEmergencyOverlay(true);
          // Start alarm automatically
          if (alarm.audioEnabled) {
            alarm.startAlarm();
          }
        }
      } else {
        setActiveEmergency(null);
        lastEmergencyRef.current = null;
      }
    };

    checkEmergency();
    interval = setInterval(checkEmergency, 15000);

    // Listen for service worker push messages
    const handleEmergencyNotification = () => {
      checkEmergency();
    };
    window.addEventListener('emergency-notification', handleEmergencyNotification);

    return () => {
      clearInterval(interval);
      window.removeEventListener('emergency-notification', handleEmergencyNotification);
    };
  }, [user, alarm]);

  // Stop alarm when overlay is dismissed
  const handleDismissOverlay = async () => {
    alarm.stopAlarm();
    setShowEmergencyOverlay(false);

    // Write acknowledgment to Supabase
    if (activeEmergency && user) {
      try {
        const { data: existing } = await supabase
          .from('emergency_acknowledgments')
          .select('*')
          .eq('emergency_id', activeEmergency.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('emergency_acknowledgments')
            .update({
              acknowledged: true,
              acknowledged_at: new Date().toISOString(),
              notification_viewed: true,
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('emergency_acknowledgments').insert({
            emergency_id: activeEmergency.id,
            user_id: user.id,
            user_name: user.full_name,
            notification_sent: true,
            notification_viewed: true,
            acknowledged: true,
            acknowledged_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Onay kaydedilemedi:', err);
      }
    }
  };

  const handleViewDetails = () => {
    alarm.stopAlarm();
    setShowEmergencyOverlay(false);
    router.push('/dashboard/acil-durum');
  };

  const handleEnableAlarm = async () => {
    await alarm.enableAudio();
    setAlarmEnabledPrompt(false);
  };

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
        {activeEmergency && !showEmergencyOverlay && (
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

        {/* Alarm enable prompt */}
        {alarmEnabledPrompt && !showEmergencyOverlay && (
          <div className="flex items-center gap-3 bg-blue-600 px-4 py-2.5 text-white">
            <Volume2 className="h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm">
              Acil durum bildirimleri geldiğinde alarm sesi çalsın mı? Ses iznini şimdi etkinleştirebilirsiniz.
            </p>
            <button
              onClick={handleEnableAlarm}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50"
            >
              Alarm Sesini Etkinleştir
            </button>
            <button
              onClick={() => setAlarmEnabledPrompt(false)}
              className="text-sm text-blue-100 underline hover:text-white"
            >
              Sonra
            </button>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Full-screen emergency overlay */}
      {showEmergencyOverlay && activeEmergency && (
        <EmergencyFullScreenOverlay
          emergency={activeEmergency}
          alarmPlaying={alarm.isPlaying}
          showManualStart={alarm.showManualStart}
          onManualStart={alarm.startAlarm}
          onDismiss={handleDismissOverlay}
          onView={handleViewDetails}
        />
      )}
    </div>
  );
}

function EmergencyFullScreenOverlay({
  emergency,
  alarmPlaying,
  showManualStart,
  onManualStart,
  onDismiss,
  onView,
}: {
  emergency: any;
  alarmPlaying: boolean;
  showManualStart: boolean;
  onManualStart: () => void;
  onDismiss: () => void;
  onView: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-rose-950/95 p-4 backdrop-blur-sm">
      {/* Pulsing red background effect */}
      <div className="pointer-events-none absolute inset-0 animate-pulse bg-rose-600/10" />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Red header */}
        <div className="bg-rose-600 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Siren className="h-9 w-9 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold">🚨 ACİL DURUM</h2>
              <p className="mt-0.5 text-sm text-rose-100">GEZİYÖNET — Acil Durum Bildirimi</p>
              {alarmPlaying && (
                <p className="mt-1 flex items-center gap-1 text-xs text-rose-100">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                  Alarm sesi çalıyor...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Emergency details */}
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="w-24 shrink-0 text-sm text-slate-500">Acil Durum:</span>
              <span className="font-semibold text-slate-800">
                {emergencyTypeLabels[emergency.emergency_type as EmergencyType]}
              </span>
            </div>
            {emergency.trips?.name && (
              <div className="flex items-start gap-2">
                <span className="w-24 shrink-0 text-sm text-slate-500">Gezi:</span>
                <span className="font-medium text-slate-700">{emergency.trips.name}</span>
              </div>
            )}
            {emergency.location && (
              <div className="flex items-start gap-2">
                <span className="w-24 shrink-0 text-sm text-slate-500">Konum:</span>
                <span className="font-medium text-slate-700">{emergency.location}</span>
              </div>
            )}
            {emergency.description && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-600">{emergency.description}</p>
              </div>
            )}
            <p className="text-xs text-slate-400">Başlatılma: {formatDateTime(emergency.created_at)}</p>
          </div>

          {/* Manual alarm start button */}
          {showManualStart && !alarmPlaying && (
            <button
              onClick={onManualStart}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <Volume2 className="h-5 w-5" /> 🔊 Alarm Sesini Başlat
            </button>
          )}

          {/* Action buttons */}
          <div className="mt-5 flex gap-2">
            <button
              onClick={onView}
              className="flex-1 rounded-lg bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Detayları Gör
            </button>
            <button
              onClick={onDismiss}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-900"
            >
              <CheckCircle className="h-4 w-4" /> GÖRDÜM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { rolePermissions };
