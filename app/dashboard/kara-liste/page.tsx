'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Pencil, Trash2, Eye, Search, UserX, Clock, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { Participant, Trip, TripRule, BlacklistEntry, BlacklistViolation, BlacklistType, BlacklistStatus } from '@/lib/types';
import { blacklistTypeLabels, blacklistStatusLabels } from '@/lib/labels';
import { formatDate, toDateInputValue, formatDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusColors: Record<BlacklistStatus, string> = {
  aktif: 'bg-rose-100 text-rose-700 border-rose-200',
  pasif: 'bg-slate-100 text-slate-500 border-slate-200',
  suresi_doldu: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  kaldirildi: 'bg-slate-100 text-slate-400 border-slate-200',
};

const typeColors: Record<BlacklistType, string> = {
  gecici: 'bg-amber-100 text-amber-700',
  suresiz: 'bg-rose-100 text-rose-700',
  inceleme_altinda: 'bg-blue-100 text-blue-700',
};

export default function BlacklistPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [violations, setViolations] = useState<Record<string, TripRule[]>>({});
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [rules, setRules] = useState<TripRule[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ruleFilter, setRuleFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BlacklistEntry | null>(null);
  const [detailEntry, setDetailEntry] = useState<any | null>(null);
  const [removeEntry, setRemoveEntry] = useState<any | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [historyEntry, setHistoryEntry] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [blRes, partRes, tripRes, ruleRes, incRes, violRes] = await Promise.all([
      supabase.from('blacklist_entries').select('*, participants(first_name, last_name, class_grade, class_section), trips(name), incidents(description)').order('created_at', { ascending: false }),
      supabase.from('participants').select('id, first_name, last_name, class_grade, class_section').order('first_name'),
      supabase.from('trips').select('*').neq('status', 'arsivlendi'),
      supabase.from('trip_rules').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('incidents').select('id, description, incident_type').order('created_at', { ascending: false }),
      supabase.from('blacklist_violations').select('*, trip_rules(rule_text)'),
    ]);
    if (blRes.data) setEntries(blRes.data as any[]);
    if (partRes.data) setParticipants(partRes.data as Participant[]);
    if (tripRes.data) setTrips(tripRes.data as Trip[]);
    if (ruleRes.data) setRules(ruleRes.data as TripRule[]);
    if (incRes.data) setIncidents(incRes.data as any[]);

    // Map violations by blacklist entry
    const vMap: Record<string, TripRule[]> = {};
    if (violRes.data) {
      (violRes.data as any[]).forEach((v) => {
        if (!vMap[v.blacklist_entry_id]) vMap[v.blacklist_entry_id] = [];
        if (v.trip_rules) vMap[v.blacklist_entry_id].push(v.trip_rules);
      });
    }
    setViolations(vMap);

    // Auto-expire: update 'gecici' entries where end_date < today
    const today = new Date().toISOString().split('T')[0];
    const expired = (blRes.data as any[]).filter((e) => e.blacklist_type === 'gecici' && e.status === 'aktif' && e.end_date && e.end_date < today);
    if (expired.length > 0) {
      for (const e of expired) {
        await supabase.from('blacklist_entries').update({ status: 'suresi_doldu', updated_at: new Date().toISOString() }).eq('id', e.id);
        await supabase.from('blacklist_history').insert({ blacklist_entry_id: e.id, action: 'süre_doldu', new_status: 'suresi_doldu', previous_status: 'aktif' });
      }
      // Re-fetch
      const { data: refetched } = await supabase.from('blacklist_entries').select('*, participants(first_name, last_name, class_grade, class_section), trips(name), incidents(description)').order('created_at', { ascending: false });
      if (refetched) setEntries(refetched as any[]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = entries.filter((e) => {
    const name = `${e.participants?.first_name || ''} ${e.participants?.last_name || ''}`.toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchesRule = ruleFilter === 'all' || (violations[e.id] || []).some((r) => r.id === ruleFilter);
    return matchesSearch && matchesStatus && matchesRule;
  });

  const handleRemove = async () => {
    if (!removeEntry) return;
    if (!removeReason.trim()) { toast.error('Kaldırma nedeni zorunludur.'); return; }
    const { error } = await supabase.from('blacklist_entries').update({
      status: 'kaldirildi', removal_reason: removeReason.trim(), removed_by: user?.full_name || null,
      removed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', removeEntry.id);
    if (error) { toast.error('İşlem başarısız: ' + error.message); return; }
    await supabase.from('blacklist_history').insert({
      blacklist_entry_id: removeEntry.id, action: 'kaldirma', action_by: user?.full_name || null,
      reason: removeReason.trim(), previous_status: removeEntry.status, new_status: 'kaldirildi',
    });
    toast.success('Öğrenci kara listeden kaldırıldı.');
    logActivity(user, 'kara_liste_kaldir', 'Kara liste kaydı kaldırıldı', 'blacklist', removeEntry.id);
    setRemoveEntry(null);
    setRemoveReason('');
    fetchData();
  };

  if (loading) return <LoadingSpinner label="Kara liste yükleniyor..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kara Liste"
        description="Gezi kurallarını ihlal eden öğrencileri yönetin"
        icon={ShieldAlert}
        actions={
          <button onClick={() => { setEditingEntry(null); setModalOpen(true); }} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Kara Listeye Ekle
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-xs text-rose-600">Aktif</p><p className="mt-1 text-2xl font-bold text-rose-700">{entries.filter(e => e.status === 'aktif').length}</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs text-amber-600">Geçici</p><p className="mt-1 text-2xl font-bold text-amber-700">{entries.filter(e => e.blacklist_type === 'gecici' && e.status === 'aktif').length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-600">Süresi Doldu</p><p className="mt-1 text-2xl font-bold text-slate-700">{entries.filter(e => e.status === 'suresi_doldu').length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Toplam</p><p className="mt-1 text-2xl font-bold text-slate-700">{entries.length}</p></div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Öğrenci ara..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="all">Tüm Durumlar</option>
          {Object.entries(blacklistStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="all">Tüm Kurallar</option>
          {rules.map((r) => <option key={r.id} value={r.id}>{r.rule_text.slice(0, 40)}...</option>)}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white"><EmptyState message="Kara liste kaydı bulunamadı." icon={<ShieldAlert className="h-12 w-12" />} /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const entryViolations = violations[entry.id] || [];
            const isActive = entry.status === 'aktif';
            return (
              <div key={entry.id} className={cn(
                'rounded-xl border p-4 shadow-sm transition',
                isActive ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'
              )}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', typeColors[entry.blacklist_type as BlacklistType])}>
                        {blacklistTypeLabels[entry.blacklist_type as BlacklistType]}
                      </span>
                      <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', statusColors[entry.status as BlacklistStatus])}>
                        {blacklistStatusLabels[entry.status as BlacklistStatus]}
                      </span>
                      {isActive && <ShieldAlert className="h-4 w-4 text-rose-500" />}
                    </div>
                    <p className="mt-2 font-medium text-slate-800">
                      {entry.participants ? `${entry.participants.first_name} ${entry.participants.last_name}` : '-'}
                      {entry.participants?.class_grade && <span className="ml-2 text-sm text-slate-400">{entry.participants.class_grade}{entry.participants.class_section ? '/' + entry.participants.class_section : ''}</span>}
                    </p>
                    {entry.trips?.name && <p className="mt-0.5 text-sm text-slate-500">{entry.trips.name}</p>}
                    {entryViolations.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        <p className="text-xs font-medium text-slate-500">İhlal edilen kurallar:</p>
                        {entryViolations.map((v) => <p key={v.id} className="text-xs text-slate-600">• {v.rule_text}</p>)}
                      </div>
                    )}
                    {entry.admin_note && <p className="mt-1 text-xs text-slate-500 line-clamp-1">{entry.admin_note}</p>}
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDate(entry.start_date)} — {entry.end_date ? formatDate(entry.end_date) : 'Süresiz'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setDetailEntry(entry)} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => setHistoryEntry(entry)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><History className="h-4 w-4" /></button>
                    <button onClick={() => { setEditingEntry(entry); setModalOpen(true); }} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                    {isActive && (
                      <button onClick={() => setRemoveEntry(entry)} className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100">
                        <UserX className="h-3.5 w-3.5" /> Kaldır
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {modalOpen && (
        <BlacklistModal
          entry={editingEntry}
          participants={participants}
          trips={trips}
          rules={rules}
          incidents={incidents}
          violations={editingEntry ? violations[editingEntry.id] || [] : []}
          user={user}
          onSaved={() => { setModalOpen(false); fetchData(); }}
          onCancel={() => { setModalOpen(false); setEditingEntry(null); }}
        />
      )}

      {/* Detail modal */}
      {detailEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailEntry(null)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl scrollbar-thin" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 font-semibold text-slate-800">Kara Liste Detayı</h3>
            <div className="space-y-2 text-sm">
              <DetailRow label="Öğrenci" value={detailEntry.participants ? `${detailEntry.participants.first_name} ${detailEntry.participants.last_name}` : '-'} />
              <DetailRow label="Tür" value={blacklistTypeLabels[detailEntry.blacklist_type as BlacklistType]} />
              <DetailRow label="Durum" value={blacklistStatusLabels[detailEntry.status as BlacklistStatus]} />
              <DetailRow label="Başlangıç" value={formatDate(detailEntry.start_date)} />
              <DetailRow label="Bitiş" value={detailEntry.end_date ? formatDate(detailEntry.end_date) : 'Süresiz'} />
              <DetailRow label="Gezi" value={detailEntry.trips?.name || '-'} />
              <div>
                <p className="mb-1 text-slate-500">İhlal edilen kurallar:</p>
                {(violations[detailEntry.id] || []).map((r) => <p key={r.id} className="text-slate-700">• {r.rule_text}</p>)}
              </div>
              <DetailRow label="Yönetici Notu" value={detailEntry.admin_note || '-'} />
              {detailEntry.removal_reason && <DetailRow label="Kaldırma Nedeni" value={detailEntry.removal_reason} />}
              {detailEntry.removed_by && <DetailRow label="Kaldıran" value={detailEntry.removed_by} />}
              {detailEntry.removed_at && <DetailRow label="Kaldırılma Tarihi" value={formatDateTime(detailEntry.removed_at)} />}
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyEntry && <HistoryModal entry={historyEntry} onClose={() => setHistoryEntry(null)} />}

      {/* Remove modal */}
      {removeEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setRemoveEntry(null); setRemoveReason(''); }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 font-semibold text-slate-800">Kara Listeden Kaldır</h3>
            <p className="mb-3 text-sm text-slate-500">{removeEntry.participants?.first_name} {removeEntry.participants?.last_name} kara listeden kaldırılacak.</p>
            <textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} rows={3} className={inputClass} placeholder="Kaldırma nedeni (zorunlu)..." />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setRemoveEntry(null); setRemoveReason(''); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
              <button onClick={handleRemove} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Kaldır</button>
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

function HistoryModal({ entry, onClose }: { entry: any; onClose: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('blacklist_history').select('*').eq('blacklist_entry_id', entry.id).order('created_at', { ascending: false });
      if (data) setHistory(data);
      setLoading(false);
    })();
  }, [entry.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 font-semibold text-slate-800">Geçmiş — {entry.participants?.first_name} {entry.participants?.last_name}</h3>
        {loading ? <p className="py-4 text-center text-sm text-slate-400">Yükleniyor...</p> : history.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Geçmiş kayıt yok.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-lg border border-slate-100 p-3">
                <p className="text-sm font-medium text-slate-700">{h.action}</p>
                {h.reason && <p className="mt-0.5 text-xs text-slate-500">{h.reason}</p>}
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(h.created_at)} {h.action_by ? `• ${h.action_by}` : ''}</p>
                {h.previous_status && h.new_status && <p className="text-xs text-slate-400">{h.previous_status} → {h.new_status}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BlacklistModal({ entry, participants, trips, rules, incidents, violations, user, onSaved, onCancel }: any) {
  const [form, setForm] = useState({
    participant_id: '', blacklist_type: 'gecici' as BlacklistType,
    start_date: toDateInputValue(new Date()), end_date: '',
    admin_note: '', status: 'aktif' as BlacklistStatus, incident_id: '',
  });
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setForm({
        participant_id: entry.participant_id, blacklist_type: entry.blacklist_type,
        start_date: toDateInputValue(entry.start_date), end_date: entry.end_date ? toDateInputValue(entry.end_date) : '',
        admin_note: entry.admin_note || '', status: entry.status, incident_id: entry.incident_id || '',
      });
      setSelectedRules(new Set(violations.map((v: TripRule) => v.id)));
    }
  }, [entry]);

  const toggleRule = (id: string) => {
    setSelectedRules((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.participant_id) { toast.error('Öğrenci seçimi zorunludur.'); return; }
    if (selectedRules.size === 0) { toast.error('En az bir kural ihlali seçmelisiniz.'); return; }
    if (form.blacklist_type === 'gecici' && !form.end_date) { toast.error('Geçici kara liste için bitiş tarihi zorunludur.'); return; }
    setSaving(true);
    const payload = {
      participant_id: form.participant_id,
      trip_id: trips.find((t: Trip) => participants.find((p: any) => p.id === form.participant_id)?.trip_id === t.id)?.id || null,
      incident_id: form.incident_id || null,
      blacklist_type: form.blacklist_type,
      start_date: form.start_date,
      end_date: form.blacklist_type === 'suresiz' ? null : (form.end_date || null),
      admin_note: form.admin_note || null,
      status: form.status,
    };

    let entryId = entry?.id;
    if (entry) {
      const { error } = await supabase.from('blacklist_entries').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', entry.id);
      setSaving(false);
      if (error) { toast.error('Güncelleme başarısız: ' + error.message); return; }
      // Update violations: delete old, insert new
      await supabase.from('blacklist_violations').delete().eq('blacklist_entry_id', entry.id);
      for (const ruleId of selectedRules) {
        await supabase.from('blacklist_violations').insert({ blacklist_entry_id: entry.id, trip_rule_id: ruleId });
      }
      toast.success('Kara liste kaydı güncellendi.');
    } else {
      const { data, error } = await supabase.from('blacklist_entries').insert(payload).select().maybeSingle();
      setSaving(false);
      if (error) { toast.error('Ekleme başarısız: ' + error.message); return; }
      if (data) {
        entryId = data.id;
        for (const ruleId of selectedRules) {
          await supabase.from('blacklist_violations').insert({ blacklist_entry_id: data.id, trip_rule_id: ruleId });
        }
        await supabase.from('blacklist_history').insert({ blacklist_entry_id: data.id, action: 'ekleme', action_by: user?.full_name || null, new_status: 'aktif' });
      }
      toast.success('Öğrenci kara listeye eklendi.');
      logActivity(user, 'kara_liste_ekle', 'Kara listeye öğrenci eklendi', 'blacklist', entryId);
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 font-semibold text-slate-800">{entry ? 'Kara Liste Düzenle' : 'Kara Listeye Ekle'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Öğrenci *</label>
              <select value={form.participant_id} onChange={(e) => setForm({ ...form, participant_id: e.target.value })} className={inputClass}>
                <option value="">Öğrenci seçin</option>
                {participants.map((p: any) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.class_grade || '-'}{p.class_section ? '/' + p.class_section : ''})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Kara Liste Türü</label>
              <select value={form.blacklist_type} onChange={(e) => setForm({ ...form, blacklist_type: e.target.value as BlacklistType })} className={inputClass}>
                {Object.entries(blacklistTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Başlangıç Tarihi</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Bitiş Tarihi {form.blacklist_type === 'suresiz' ? '(Süresiz - boş)' : ''}</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} disabled={form.blacklist_type === 'suresiz'} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">İlgili Olay (isteğe bağlı)</label>
              <select value={form.incident_id} onChange={(e) => setForm({ ...form, incident_id: e.target.value })} className={inputClass}>
                <option value="">Olay seçilmedi</option>
                {incidents.map((i: any) => <option key={i.id} value={i.id}>{i.description?.slice(0, 40) || i.incident_type}...</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Durum</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BlacklistStatus })} className={inputClass}>
                {Object.entries(blacklistStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Multi-select rule violations */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">İhlal Edilen Kurallar * (çoklu seçim)</label>
            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3 scrollbar-thin">
              {rules.map((rule: TripRule) => (
                <label key={rule.id} className="flex items-start gap-2 rounded-md p-2 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selectedRules.has(rule.id)} onChange={() => toggleRule(rule.id)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600" />
                  <span className="text-sm text-slate-700">{rule.rule_text}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">{selectedRules.size} kural seçildi</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Yönetici Notu</label>
            <textarea value={form.admin_note} onChange={(e) => setForm({ ...form, admin_note: e.target.value })} rows={3} className={inputClass} placeholder="Ayrıntılı yönetici notu..." />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Kaydediliyor...' : entry ? 'Güncelle' : 'Ekle'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
