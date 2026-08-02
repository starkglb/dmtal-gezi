'use client';

import { useState, useEffect } from 'react';
import { Siren, AlertTriangle, CheckCircle, X, Eye, Clock, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { Trip, Emergency, EmergencyType, EmergencyUrgency, EmergencyStatus, SystemUser } from '@/lib/types';
import { emergencyTypeLabels, emergencyUrgencyLabels, emergencyStatusLabels } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const urgencyColors: Record<EmergencyUrgency, string> = {
  dusuk: 'bg-blue-100 text-blue-700',
  orta: 'bg-amber-100 text-amber-700',
  yuksek: 'bg-orange-100 text-orange-700',
  kritik: 'bg-rose-100 text-rose-700',
};

const statusColors: Record<EmergencyStatus, string> = {
  aktif: 'bg-rose-600 text-white',
  mudahale_ediliyor: 'bg-amber-500 text-white',
  cozuldu: 'bg-emerald-500 text-white',
  kapatildi: 'bg-slate-400 text-white',
};

export default function EmergencyPage() {
  const { user } = useAuth();
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [activeEmergency, setActiveEmergency] = useState<any | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [staff, setStaff] = useState<SystemUser[]>([]);
  const [acks, setAcks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startModal, setStartModal] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [resolveModal, setResolveModal] = useState<any | null>(null);
  const [detailEmergency, setDetailEmergency] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [emRes, tripRes, staffRes] = await Promise.all([
      supabase.from('emergencies').select('*, trips(name)').order('created_at', { ascending: false }),
      supabase.from('trips').select('*').neq('status', 'arsivlendi').order('trip_date', { ascending: false }),
      supabase.from('system_users').select('*').eq('is_active', true).order('full_name'),
    ]);
    if (emRes.data) {
      setEmergencies(emRes.data as any[]);
      const active = (emRes.data as any[]).find((e) => e.status === 'aktif' || e.status === 'mudahale_ediliyor');
      setActiveEmergency(active || null);
      if (active) {
        const { data: ackData } = await supabase.from('emergency_acknowledgments').select('*, system_users!inner(full_name)').eq('emergency_id', active.id);
        setAcks(ackData || []);
      }
    }
    if (tripRes.data) setTrips(tripRes.data as Trip[]);
    if (staffRes.data) setStaff(staffRes.data as SystemUser[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleStart = () => {
    setStartModal(true);
  };

  const handleCreateEmergency = async (formData: any) => {
    setSaving(true);
    const notifyIds = formData.notifyUserIds || [];
    const { data, error } = await supabase.from('emergencies').insert({
      trip_id: formData.tripId || null,
      emergency_type: formData.emergencyType,
      location: formData.location || null,
      description: formData.description || null,
      urgency_level: formData.urgencyLevel,
      status: 'aktif',
      created_by: user?.full_name || null,
      created_by_user_id: user?.id || null,
      notify_user_ids: notifyIds.join(','),
    }).select().maybeSingle();
    setSaving(false);
    if (error) { toast.error('Acil durum oluşturulamadı: ' + error.message); return; }
    if (data) {
      // Create acknowledgment records for notified users
      for (const userId of notifyIds) {
        const staffMember = staff.find((s) => s.id === userId);
        await supabase.from('emergency_acknowledgments').insert({
          emergency_id: data.id,
          user_id: userId,
          user_name: staffMember?.full_name || null,
          notification_sent: true,
        });
      }
      // Try to send push notifications via edge function
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emergencyId: data.id }),
        });
      } catch (e) {
        console.warn('Push notification gönderilemedi:', e);
      }
      toast.success('Acil durum başlatıldı ve yetkililere bildirildi.');
      logActivity(user, 'acil_durum_baslat', 'Acil durum başlatıldı', 'emergency', data.id);
    }
    setStartModal(false);
    setConfirmStart(false);
    fetchData();
  };

  const handleResolve = async (formData: any) => {
    if (!resolveModal) return;
    const { error } = await supabase.from('emergencies').update({
      status: 'kapatildi',
      resolution_note: formData.resolutionNote || null,
      resolution_result: formData.resolutionResult || null,
      resolved_by: user?.full_name || null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', resolveModal.id);
    if (error) { toast.error('Sonlandırma başarısız: ' + error.message); return; }
    toast.success('Acil durum sonlandırıldı.');
    logActivity(user, 'acil_durum_kapat', 'Acil durum sonlandırıldı', 'emergency', resolveModal.id);
    setResolveModal(null);
    fetchData();
  };

  const handleAcknowledge = async (emergencyId: string) => {
    if (!user) return;
    const { data: existing } = await supabase.from('emergency_acknowledgments').select('*').eq('emergency_id', emergencyId).eq('user_id', user.id).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('emergency_acknowledgments').update({
        acknowledged: true, acknowledged_at: new Date().toISOString(), notification_viewed: true,
      }).eq('id', existing.id);
      if (error) { toast.error('Onay başarısız.'); return; }
    } else {
      await supabase.from('emergency_acknowledgments').insert({
        emergency_id: emergencyId, user_id: user.id, user_name: user.full_name,
        notification_sent: true, notification_viewed: true, acknowledged: true, acknowledged_at: new Date().toISOString(),
      });
    }
    toast.success('Acil durum görüldü olarak işaretlendi.');
    fetchData();
  };

  if (loading) return <LoadingSpinner label="Acil durumlar yükleniyor..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acil Durum Merkezi"
        description="Acil durumları başlatın, yönetin ve sonlandırın"
        icon={Siren}
      />

      {/* Active emergency banner */}
      {activeEmergency && (
        <div className={cn(
          'rounded-xl border-2 p-5 shadow-lg',
          activeEmergency.status === 'aktif' ? 'border-rose-500 bg-rose-50' : 'border-amber-400 bg-amber-50'
        )}>
          <div className="flex items-start gap-3">
            <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white', activeEmergency.status === 'aktif' ? 'bg-rose-600' : 'bg-amber-500')}>
              <Siren className="h-6 w-6 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800">{emergencyTypeLabels[activeEmergency.emergency_type as EmergencyType]}</h3>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusColors[activeEmergency.status as EmergencyStatus])}>
                  {emergencyStatusLabels[activeEmergency.status as EmergencyStatus]}
                </span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', urgencyColors[activeEmergency.urgency_level as EmergencyUrgency])}>
                  {emergencyUrgencyLabels[activeEmergency.urgency_level as EmergencyUrgency]}
                </span>
              </div>
              {activeEmergency.trips?.name && <p className="mt-1 text-sm text-slate-600">Gezi: {activeEmergency.trips.name}</p>}
              {activeEmergency.location && <p className="text-sm text-slate-600">Konum: {activeEmergency.location}</p>}
              {activeEmergency.description && <p className="mt-1 text-sm text-slate-700">{activeEmergency.description}</p>}
              <p className="mt-1 text-xs text-slate-500">Başlatan: {activeEmergency.created_by || '-'} • {formatDateTime(activeEmergency.created_at)}</p>

              {/* Acknowledgment status */}
              {acks.length > 0 && (
                <div className="mt-3 rounded-lg bg-white/60 p-3">
                  <p className="mb-1.5 text-xs font-medium text-slate-600">Yetkili Onay Durumu:</p>
                  <div className="space-y-1">
                    {acks.map((ack) => (
                      <div key={ack.id} className="flex items-center gap-2 text-xs">
                        {ack.acknowledged ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                        <span className="text-slate-600">{ack.user_name}</span>
                        <span className={ack.acknowledged ? 'text-emerald-600' : 'text-amber-600'}>
                          {ack.acknowledged ? 'Gördü' : 'Bekleniyor'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {activeEmergency.status === 'aktif' && (
                  <button onClick={() => setResolveModal(activeEmergency)} className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    <CheckCircle className="h-4 w-4" /> Acil Durumu Sonlandır
                  </button>
                )}
                <button onClick={() => handleAcknowledge(activeEmergency.id)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Eye className="h-4 w-4" /> Gördüm
                </button>
                <button onClick={() => setDetailEmergency(activeEmergency)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Detay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start button */}
      {!activeEmergency && (
        <div className="rounded-xl border-2 border-dashed border-rose-300 bg-rose-50/50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
            <Siren className="h-8 w-8 text-rose-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Aktif Acil Durum Yok</h3>
          <p className="mt-1 text-sm text-slate-500">Gerekirse aşağıdaki butona basarak acil durum başlatabilirsiniz.</p>
          <button
            onClick={() => setConfirmStart(true)}
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-rose-700 hover:shadow-xl"
          >
            <Siren className="h-5 w-5" /> ACİL DURUM BAŞLAT
          </button>
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-800">Acil Durum Geçmişi</h3>
        {emergencies.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Acil durum kaydı yok.</p>
        ) : (
          <div className="space-y-2">
            {emergencies.map((em) => (
              <div key={em.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', em.status === 'aktif' ? 'bg-rose-100' : em.status === 'mudahale_ediliyor' ? 'bg-amber-100' : 'bg-slate-100')}>
                  <Siren className={cn('h-4 w-4', em.status === 'aktif' ? 'text-rose-600' : em.status === 'mudahale_ediliyor' ? 'text-amber-600' : 'text-slate-400')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700">{emergencyTypeLabels[em.emergency_type as EmergencyType]}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(em.created_at)} • {em.trips?.name || '-'}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusColors[em.status as EmergencyStatus])}>
                  {emergencyStatusLabels[em.status as EmergencyStatus]}
                </span>
                <button onClick={() => setDetailEmergency(em)} className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Eye className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm start */}
      <ConfirmDialog
        open={confirmStart}
        onOpenChange={setConfirmStart}
        title="🚨 ACİL DURUM BAŞLATILSIN MI?"
        description="Bu işlem yetkili kullanıcılara acil durum bildirimi gönderecek ve aktif bir acil durum kaydı oluşturacaktır."
        confirmText="ACİL DURUMU BAŞLAT"
        cancelText="İptal"
        destructive={true}
        onConfirm={() => { setConfirmStart(false); setStartModal(true); }}
      />

      {/* Start modal */}
      {startModal && (
        <EmergencyFormModal
          trips={trips}
          staff={staff}
          onSaved={handleCreateEmergency}
          onCancel={() => setStartModal(false)}
        />
      )}

      {/* Resolve modal */}
      {resolveModal && (
        <ResolveModal
          emergency={resolveModal}
          onSaved={handleResolve}
          onCancel={() => setResolveModal(null)}
        />
      )}

      {/* Detail modal */}
      {detailEmergency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailEmergency(null)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl scrollbar-thin" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 font-semibold text-slate-800">Acil Durum Detayı</h3>
            <div className="space-y-2 text-sm">
              <DetailRow label="Tür" value={emergencyTypeLabels[detailEmergency.emergency_type as EmergencyType]} />
              <DetailRow label="Durum" value={emergencyStatusLabels[detailEmergency.status as EmergencyStatus]} />
              <DetailRow label="Aciliyet" value={emergencyUrgencyLabels[detailEmergency.urgency_level as EmergencyUrgency]} />
              <DetailRow label="Gezi" value={detailEmergency.trips?.name || '-'} />
              <DetailRow label="Konum" value={detailEmergency.location || '-'} />
              <DetailRow label="Açıklama" value={detailEmergency.description || '-'} />
              <DetailRow label="Başlatan" value={detailEmergency.created_by || '-'} />
              <DetailRow label="Başlatılma" value={formatDateTime(detailEmergency.created_at)} />
              {detailEmergency.resolved_by && <DetailRow label="Sonlandıran" value={detailEmergency.resolved_by} />}
              {detailEmergency.resolution_note && <DetailRow label="Çözüm Notu" value={detailEmergency.resolution_note} />}
              {detailEmergency.resolution_result && <DetailRow label="Sonuç" value={detailEmergency.resolution_result} />}
              {detailEmergency.resolved_at && <DetailRow label="Sonlandırılma" value={formatDateTime(detailEmergency.resolved_at)} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex border-b border-slate-50 pb-2"><span className="w-32 shrink-0 text-slate-500">{label}</span><span className="flex-1 font-medium text-slate-700">{value}</span></div>;
}

function EmergencyFormModal({ trips, staff, onSaved, onCancel }: any) {
  const [form, setForm] = useState({
    tripId: '', emergencyType: 'saglik_durumu' as EmergencyType, location: '',
    description: '', urgencyLevel: 'orta' as EmergencyUrgency, notifyUserIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const toggleUser = (id: string) => {
    setForm((prev) => ({ ...prev, notifyUserIds: prev.notifyUserIds.includes(id) ? prev.notifyUserIds.filter((x) => x !== id) : [...prev.notifyUserIds, id] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSaved(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-rose-700"><Siren className="h-5 w-5" /> Acil Durum Oluştur</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">İlgili Gezi</label>
              <select value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })} className={inputClass}>
                <option value="">Gezi seçin</option>
                {trips.map((t: Trip) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Acil Durum Türü</label>
              <select value={form.emergencyType} onChange={(e) => setForm({ ...form, emergencyType: e.target.value as EmergencyType })} className={inputClass}>
                {Object.entries(emergencyTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Aciliyet Seviyesi</label>
              <select value={form.urgencyLevel} onChange={(e) => setForm({ ...form, urgencyLevel: e.target.value as EmergencyUrgency })} className={inputClass}>
                {Object.entries(emergencyUrgencyLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Konum / Bulunduğu Yer</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass} placeholder="Örn. Otobüs 1, müze girişi..." />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Acil Durum Açıklaması</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputClass} placeholder="Durumun detaylı açıklaması..." />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Bildirim Gönderilecek Yetkililer</label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3 scrollbar-thin">
              {staff.map((s: SystemUser) => (
                <label key={s.id} className="flex items-center gap-2 rounded-md p-1.5 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={form.notifyUserIds.includes(s.id)} onChange={() => toggleUser(s.id)} className="h-4 w-4 rounded border-slate-300 text-rose-600" />
                  <span className="text-sm text-slate-700">{s.full_name}</span>
                  <span className="text-xs text-slate-400">{s.email}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">{form.notifyUserIds.length} yetkili seçildi</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60">
              <Siren className="h-4 w-4" /> {saving ? 'Başlatılıyor...' : 'ACİL DURUMU BAŞLAT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResolveModal({ emergency, onSaved, onCancel }: any) {
  const [form, setForm] = useState({ resolutionNote: '', resolutionResult: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSaved(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 font-semibold text-slate-800">Acil Durumu Sonlandır</h3>
        <p className="mb-3 text-sm text-slate-500">Acil durum bildirimi kapatılacak ve kayıt çözüldü olarak işaretlenecektir.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Çözüm Notu</label>
            <textarea value={form.resolutionNote} onChange={(e) => setForm({ ...form, resolutionNote: e.target.value })} rows={3} className={inputClass} placeholder="Yapılan müdahale ve çözüm..." />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sonuç</label>
            <input value={form.resolutionResult} onChange={(e) => setForm({ ...form, resolutionResult: e.target.value })} className={inputClass} placeholder="Örn. Öğrenci güvenlikte, durum çözüldü" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{saving ? 'Sonlandırılıyor...' : 'Sonlandır'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
