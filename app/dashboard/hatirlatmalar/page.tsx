'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Pencil, Trash2, Check, CheckCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { Trip, Reminder, ReminderStatus, ReminderType } from '@/lib/types';
import { reminderStatusLabels, reminderTypeLabels } from '@/lib/labels';
import { formatDate, toDateInputValue } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusColors: Record<ReminderStatus, string> = {
  okunmadi: 'bg-rose-100 text-rose-700',
  okundu: 'bg-blue-100 text-blue-700',
  tamamlandi: 'bg-emerald-100 text-emerald-700',
};

export default function RemindersPage() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [re, tr] = await Promise.all([
      supabase.from('reminders').select('*').order('reminder_date', { ascending: true }),
      supabase.from('trips').select('*').neq('status', 'arsivlendi'),
    ]);
    if (re.data) setReminders(re.data as Reminder[]);
    if (tr.data) setTrips(tr.data as Trip[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleStatusChange = async (id: string, status: ReminderStatus) => {
    const { error } = await supabase.from('reminders').update({ status }).eq('id', id);
    if (error) toast.error('Güncelleme başarısız');
    else fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('reminders').delete().eq('id', deleteId);
    if (error) toast.error('Silme başarısız');
    else { toast.success('Hatırlatma silindi.'); fetchData(); }
    setDeleteId(null);
  };

  if (loading) return <LoadingSpinner />;

  const unread = reminders.filter((r) => r.status === 'okunmadi');
  const completed = reminders.filter((r) => r.status === 'tamamlandi');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hatırlatmalar"
        description={`${unread.length} okunmamış, ${completed.length} tamamlanmış`}
        icon={Bell}
        actions={
          <button onClick={() => { setEditingReminder(null); setModalOpen(true); }} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Yeni Hatırlatma
          </button>
        }
      />

      {reminders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white"><EmptyState message="Henüz hatırlatma eklenmedi." icon={<Bell className="h-12 w-12" />} /></div>
      ) : (
        <div className="space-y-2">
          {reminders.map((r) => {
            const trip = trips.find((t) => t.id === r.trip_id);
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', statusColors[r.status])}>
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{r.title}</p>
                  {r.description && <p className="text-sm text-slate-500">{r.description}</p>}
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span>{formatDate(r.reminder_date)}</span>
                    {trip && <span>• {trip.name}</span>}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{reminderTypeLabels[r.type]}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {r.status !== 'okundu' && r.status !== 'tamamlandi' && (
                    <button onClick={() => handleStatusChange(r.id, 'okundu')} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Okundu işaretle">
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  {r.status !== 'tamamlandi' && (
                    <button onClick={() => handleStatusChange(r.id, 'tamamlandi')} className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Tamamlandı işaretle">
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => { setEditingReminder(r); setModalOpen(true); }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteId(r.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusColors[r.status])}>{reminderStatusLabels[r.status]}</span>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingReminder ? 'Hatırlatma Düzenle' : 'Yeni Hatırlatma'}</DialogTitle></DialogHeader>
          {modalOpen && <ReminderForm reminder={editingReminder} trips={trips} onSaved={() => { setModalOpen(false); fetchData(); }} onCancel={() => setModalOpen(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)} title="Hatırlatmayı Sil" description="Bu hatırlatmayı silmek istediğinizden emin misiniz?" confirmText="Evet, Sil" onConfirm={handleDelete} />
    </div>
  );
}

function ReminderForm({ reminder, trips, onSaved, onCancel }: { reminder: Reminder | null; trips: Trip[]; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', reminder_date: '', trip_id: '',
    type: 'genel' as ReminderType, status: 'okunmadi' as ReminderStatus,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (reminder) setForm({
      title: reminder.title, description: reminder.description || '',
      reminder_date: toDateInputValue(reminder.reminder_date), trip_id: reminder.trip_id || '',
      type: reminder.type, status: reminder.status,
    });
  }, [reminder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.reminder_date) { toast.error('Başlık ve tarih zorunludur.'); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(), description: form.description || null,
      reminder_date: form.reminder_date, trip_id: form.trip_id || null,
      type: form.type, status: form.status,
    };
    if (reminder) {
      const { error } = await supabase.from('reminders').update(payload).eq('id', reminder.id);
      setSaving(false);
      if (error) { toast.error('Güncelleme başarısız'); return; }
      toast.success('Hatırlatma güncellendi.');
    } else {
      const { error } = await supabase.from('reminders').insert(payload);
      setSaving(false);
      if (error) { toast.error('Ekleme başarısız'); return; }
      toast.success('Hatırlatma eklendi.');
    }
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Başlık *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} /></div>
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Açıklama</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputClass} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="mb-1 block text-sm font-medium text-slate-700">Tarih *</label><input type="date" value={form.reminder_date} onChange={(e) => setForm({ ...form, reminder_date: e.target.value })} className={inputClass} /></div>
        <div><label className="mb-1 block text-sm font-medium text-slate-700">Tür</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ReminderType })} className={inputClass}>{Object.entries(reminderTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="mb-1 block text-sm font-medium text-slate-700">Gezi</label><select value={form.trip_id} onChange={(e) => setForm({ ...form, trip_id: e.target.value })} className={inputClass}><option value="">Genel</option>{trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label className="mb-1 block text-sm font-medium text-slate-700">Durum</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ReminderStatus })} className={inputClass}>{Object.entries(reminderStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Kaydediliyor...' : reminder ? 'Güncelle' : 'Ekle'}</button>
      </div>
    </form>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
