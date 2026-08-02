'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Pencil, Trash2, Eye, Search, FileDown, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { Trip, Participant, Incident, IncidentType, IncidentStatus } from '@/lib/types';
import { incidentTypeLabels, incidentStatusLabels } from '@/lib/labels';
import { formatDate, toDateInputValue } from '@/lib/format';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusColors: Record<IncidentStatus, string> = {
  acik: 'bg-rose-100 text-rose-700',
  inceleniyor: 'bg-amber-100 text-amber-700',
  cozuldu: 'bg-emerald-100 text-emerald-700',
  kapatildi: 'bg-slate-100 text-slate-500',
};

const typeColors: Record<IncidentType, string> = {
  disiplin_sorunu: 'bg-rose-50 text-rose-600',
  gezi_kurallarina_uymama: 'bg-amber-50 text-amber-600',
  ogretmen_talimatina_uymama: 'bg-amber-50 text-amber-600',
  gruptan_izinsiz_ayrilma: 'bg-rose-50 text-rose-600',
  gec_kalma: 'bg-blue-50 text-blue-600',
  otobus_kurallari_ihlali: 'bg-amber-50 text-amber-600',
  katilimcilari_rahatsiz_etme: 'bg-amber-50 text-amber-600',
  fiziksel_sozlu_tartisma: 'bg-rose-50 text-rose-600',
  esyaya_zarar_verme: 'bg-amber-50 text-amber-600',
  guvenlik_kurallari_ihlali: 'bg-rose-50 text-rose-600',
  diger: 'bg-slate-50 text-slate-600',
};

export default function IncidentsPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [detailIncident, setDetailIncident] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [incRes, tripRes, partRes] = await Promise.all([
      supabase.from('incidents').select('*, trips(name), participants(first_name, last_name, class_grade, class_section)').order('created_at', { ascending: false }),
      supabase.from('trips').select('*').neq('status', 'arsivlendi').order('trip_date', { ascending: false }),
      supabase.from('participants').select('id, first_name, last_name, class_grade, class_section, trip_id').neq('status', 'iptal_edildi').order('first_name'),
    ]);
    if (incRes.data) setIncidents(incRes.data as any[]);
    if (tripRes.data) setTrips(tripRes.data as Trip[]);
    if (partRes.data) setParticipants(partRes.data as Participant[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = incidents.filter((inc) => {
    const name = `${inc.participants?.first_name || ''} ${inc.participants?.last_name || ''}`.toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase()) || (inc.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;
    const matchesType = typeFilter === 'all' || inc.incident_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('incidents').delete().eq('id', deleteId);
    if (error) { toast.error('Silme başarısız: ' + error.message); }
    else { toast.success('Olay kaydı silindi.'); fetchData(); }
    setDeleteId(null);
  };

  const handlePdf = async () => {
    try {
      await generatePdf({
        title: 'Olay Kayıtları',
        reportName: 'Olay ve Durum Kayıt Listesi',
        columns: [
          { key: 'no', header: '#', width: 25, align: 'center' },
          { key: 'student', header: 'Öğrenci', width: 'auto' },
          { key: 'trip', header: 'Gezi', width: 'auto' },
          { key: 'type', header: 'Olay Türü', width: 100 },
          { key: 'date', header: 'Tarih', width: 60 },
          { key: 'status', header: 'Durum', width: 50, align: 'center' },
        ],
        rows: filtered.map((inc, i) => ({
          no: i + 1,
          student: inc.participants ? `${inc.participants.first_name} ${inc.participants.last_name}` : '-',
          trip: inc.trips?.name || '-',
          type: incidentTypeLabels[inc.incident_type as IncidentType],
          date: formatDate(inc.incident_date),
          status: incidentStatusLabels[inc.status as IncidentStatus],
        })),
        fileName: buildFileName(['Olay_Kayitlari', formatDate(new Date()).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) { toast.error('PDF hatası: ' + err.message); }
  };

  if (loading) return <LoadingSpinner label="Olay kayıtları yükleniyor..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Olay ve Durumlar"
        description="Gezi sırasında yaşanan olayları kaydedin ve takip edin"
        icon={AlertTriangle}
        actions={
          <button onClick={() => { setEditingIncident(null); setModalOpen(true); }} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Yeni Olay
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Öğrenci veya açıklama ara..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="all">Tüm Durumlar</option>
          {Object.entries(incidentStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="all">Tüm Türler</option>
          {Object.entries(incidentTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ActionButton onClick={handlePdf} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>PDF</ActionButton>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white"><EmptyState message="Olay kaydı bulunamadı." icon={<AlertTriangle className="h-12 w-12" />} /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inc) => (
            <div key={inc.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', typeColors[inc.incident_type as IncidentType])}>
                      {incidentTypeLabels[inc.incident_type as IncidentType]}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusColors[inc.status as IncidentStatus])}>
                      {incidentStatusLabels[inc.status as IncidentStatus]}
                    </span>
                    {inc.send_to_blacklist && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Kara Listeye Gönderildi</span>
                    )}
                  </div>
                  <p className="mt-2 font-medium text-slate-800">
                    {inc.participants ? `${inc.participants.first_name} ${inc.participants.last_name}` : '-'}
                    {inc.participants?.class_grade && <span className="ml-2 text-sm text-slate-400">{inc.participants.class_grade}{inc.participants.class_section ? '/' + inc.participants.class_section : ''}</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{inc.trips?.name || '-'}</p>
                  {inc.description && <p className="mt-1 text-sm text-slate-600 line-clamp-2">{inc.description}</p>}
                  <p className="mt-1 text-xs text-slate-400">{formatDate(inc.incident_date)} {inc.incident_time || ''} • {inc.location || '-'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setDetailIncident(inc)} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Eye className="h-4 w-4" /></button>
                  <button onClick={() => { setEditingIncident(inc); setModalOpen(true); }} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteId(inc.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {modalOpen && (
        <IncidentModal
          incident={editingIncident}
          trips={trips}
          participants={participants}
          user={user}
          onSaved={() => { setModalOpen(false); fetchData(); }}
          onCancel={() => { setModalOpen(false); setEditingIncident(null); }}
        />
      )}

      {/* Detail modal */}
      {detailIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailIncident(null)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl scrollbar-thin" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Olay Detayı</h3>
              <button onClick={() => setDetailIncident(null)} className="text-slate-400 hover:text-slate-600"><ArrowLeft className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <DetailRow label="Öğrenci" value={detailIncident.participants ? `${detailIncident.participants.first_name} ${detailIncident.participants.last_name}` : '-'} />
              <DetailRow label="Gezi" value={detailIncident.trips?.name || '-'} />
              <DetailRow label="Olay Türü" value={incidentTypeLabels[detailIncident.incident_type as IncidentType]} />
              <DetailRow label="Tarih" value={`${formatDate(detailIncident.incident_date)} ${detailIncident.incident_time || ''}`} />
              <DetailRow label="Yer" value={detailIncident.location || '-'} />
              <DetailRow label="İlgilenen" value={detailIncident.handled_by || '-'} />
              <DetailRow label="Durum" value={incidentStatusLabels[detailIncident.status as IncidentStatus]} />
              <DetailRow label="Açıklama" value={detailIncident.description || '-'} />
              <DetailRow label="Yönetici Notu" value={detailIncident.admin_note || '-'} />
              <DetailRow label="Kara Listeye Gönder" value={detailIncident.send_to_blacklist ? 'Evet' : 'Hayır'} />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Olay Kaydını Sil"
        description="Bu olay kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Evet, Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border-b border-slate-50 pb-2">
      <span className="w-32 shrink-0 text-slate-500">{label}</span>
      <span className="flex-1 font-medium text-slate-700">{value}</span>
    </div>
  );
}

function IncidentModal({ incident, trips, participants, user, onSaved, onCancel }: any) {
  const [form, setForm] = useState({
    trip_id: '', participant_id: '', incident_type: 'diger' as IncidentType,
    incident_date: toDateInputValue(new Date()), incident_time: '', location: '',
    description: '', handled_by: '', status: 'acik' as IncidentStatus, admin_note: '', send_to_blacklist: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (incident) {
      setForm({
        trip_id: incident.trip_id || '', participant_id: incident.participant_id || '',
        incident_type: incident.incident_type, incident_date: toDateInputValue(incident.incident_date),
        incident_time: incident.incident_time || '', location: incident.location || '',
        description: incident.description || '', handled_by: incident.handled_by || '',
        status: incident.status, admin_note: incident.admin_note || '', send_to_blacklist: incident.send_to_blacklist,
      });
    }
  }, [incident]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.participant_id) { toast.error('Öğrenci seçimi zorunludur.'); return; }
    setSaving(true);
    const payload = {
      trip_id: form.trip_id || null,
      participant_id: form.participant_id || null,
      incident_type: form.incident_type,
      incident_date: form.incident_date,
      incident_time: form.incident_time || null,
      location: form.location || null,
      description: form.description || null,
      handled_by: form.handled_by || null,
      status: form.status,
      admin_note: form.admin_note || null,
      send_to_blacklist: form.send_to_blacklist,
    };
    if (incident) {
      const { error } = await supabase.from('incidents').update(payload).eq('id', incident.id);
      setSaving(false);
      if (error) { toast.error('Güncelleme başarısız: ' + error.message); return; }
      toast.success('Olay güncellendi.');
    } else {
      const { error } = await supabase.from('incidents').insert(payload);
      setSaving(false);
      if (error) { toast.error('Ekleme başarısız: ' + error.message); return; }
      toast.success('Olay kaydı oluşturuldu.');
      logActivity(user, 'olay_ekle', 'Yeni olay kaydı oluşturuldu', 'incident');

      // If send_to_blacklist is true, create a blacklist entry
      if (form.send_to_blacklist && form.participant_id) {
        const blPayload: any = {
          participant_id: form.participant_id,
          trip_id: form.trip_id || null,
          blacklist_type: 'inceleme_altinda',
          start_date: form.incident_date,
          admin_note: `Olay kaydından otomatik oluşturuldu: ${form.description || ''}`,
          status: 'aktif',
        };
        await supabase.from('blacklist_entries').insert(blPayload);
        toast.info('Öğrenci kara listeye de eklendi (İnceleme Altında).');
      }
    }
    onSaved();
  };

  const filteredParticipants = form.trip_id ? participants.filter((p: any) => p.trip_id === form.trip_id) : participants;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 font-semibold text-slate-800">{incident ? 'Olay Düzenle' : 'Yeni Olay Kaydı'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">İlgili Gezi</label>
              <select value={form.trip_id} onChange={(e) => setForm({ ...form, trip_id: e.target.value, participant_id: '' })} className={inputClass}>
                <option value="">Gezi seçin</option>
                {trips.map((t: Trip) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Öğrenci *</label>
              <select value={form.participant_id} onChange={(e) => setForm({ ...form, participant_id: e.target.value })} className={inputClass}>
                <option value="">Öğrenci seçin</option>
                {filteredParticipants.map((p: any) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.class_grade || '-'}{p.class_section ? '/' + p.class_section : ''})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Olay Türü</label>
              <select value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value as IncidentType })} className={inputClass}>
                {Object.entries(incidentTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Olay Durumu</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IncidentStatus })} className={inputClass}>
                {Object.entries(incidentStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tarih *</label>
              <input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Saat</label>
              <input value={form.incident_time} onChange={(e) => setForm({ ...form, incident_time: e.target.value })} className={inputClass} placeholder="14:30" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Olayın Geçekleştiği Yer</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass} placeholder="Örn. Otobüs, müze, restoran..." />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Olay Açıklaması</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputClass} placeholder="Olayın detaylı açıklaması..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">İlgilenen Öğretmen/Görevli</label>
              <input value={form.handled_by} onChange={(e) => setForm({ ...form, handled_by: e.target.value })} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Yönetici Notu</label>
              <textarea value={form.admin_note} onChange={(e) => setForm({ ...form, admin_note: e.target.value })} rows={2} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3">
                <input type="checkbox" checked={form.send_to_blacklist} onChange={(e) => setForm({ ...form, send_to_blacklist: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-rose-600" />
                <span className="text-sm text-slate-700">Kara liste değerlendirmesine gönder (İnceleme Altında)</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Kaydediliyor...' : incident ? 'Güncelle' : 'Oluştur'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
