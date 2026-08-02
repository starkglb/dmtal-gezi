'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Bus as BusIcon, FileDown, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Trip, Bus } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';

export function TripBusesTab({ trip }: { trip: Trip }) {
  const { user } = useAuth();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [busRes, partRes] = await Promise.all([
      supabase.from('buses').select('*').eq('trip_id', trip.id).order('bus_number'),
      supabase.from('participants').select('id, first_name, last_name, bus_id, class_grade, class_section').eq('trip_id', trip.id).neq('status', 'iptal_edildi'),
    ]);
    if (busRes.data) setBuses(busRes.data as Bus[]);
    if (partRes.data) setParticipants(partRes.data as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [trip.id]);

  const handleDelete = async () => {
    if (!deleteId) return;
    // Clear bus assignment from participants first
    await supabase.from('participants').update({ bus_id: null }).eq('bus_id', deleteId);
    await supabase.from('seats').delete().eq('bus_id', deleteId);
    const { error } = await supabase.from('buses').delete().eq('id', deleteId);
    if (error) { toast.error('Silme başarısız: ' + error.message); }
    else { toast.success('Otobüs silindi.'); logActivity(user, 'otobus_sil', 'Otobüs silindi', 'bus', deleteId); fetchData(); }
    setDeleteId(null);
  };

  const handlePdf = async () => {
    try {
      const rows = buses.map((b) => {
        const count = participants.filter((p) => p.bus_id === b.id).length;
        const fillRate = b.capacity > 0 ? Math.round((count / b.capacity) * 100) : 0;
        return {
          no: b.bus_number,
          plate: b.plate || '-',
          company: b.company || '-',
          capacity: String(b.capacity),
          filled: String(count),
          empty: String(b.capacity - count),
          fillRate: `%${fillRate}`,
          driver: b.driver_name || '-',
          teacher: b.responsible_teacher || '-',
        };
      });
      await generatePdf({
        title: trip.name,
        reportName: 'Otobüs Doluluk Raporu',
        tripName: trip.name,
        columns: [
          { key: 'no', header: 'Otobüs No', width: 60 },
          { key: 'plate', header: 'Plaka', width: 70 },
          { key: 'company', header: 'Firma', width: 'auto' },
          { key: 'capacity', header: 'Kapasite', width: 50, align: 'center' },
          { key: 'filled', header: 'Dolu', width: 40, align: 'center' },
          { key: 'empty', header: 'Boş', width: 40, align: 'center' },
          { key: 'fillRate', header: 'Doluluk', width: 50, align: 'center' },
          { key: 'driver', header: 'Şoför', width: 'auto' },
          { key: 'teacher', header: 'Sorumlu', width: 'auto' },
        ],
        rows,
        fileName: buildFileName([trip.name, 'Otobus_Doluluk', formatDate(trip.trip_date).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) { toast.error('PDF hatası: ' + err.message); }
  };

  if (loading) return <LoadingSpinner label="Otobüsler yükleniyor..." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-700">Otobüsler ({buses.length})</h3>
        <div className="flex gap-2">
          <ActionButton onClick={handlePdf} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>Doluluk PDF</ActionButton>
          <button onClick={() => { setEditingBus(null); setModalOpen(true); }} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Otobüs Ekle
          </button>
        </div>
      </div>

      {buses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState message="Henüz otobüs eklenmedi." icon={<BusIcon className="h-12 w-12" />} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {buses.map((bus) => {
            const count = participants.filter((p) => p.bus_id === bus.id).length;
            const fillRate = bus.capacity > 0 ? Math.round((count / bus.capacity) * 100) : 0;
            return (
              <div key={bus.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <BusIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800">Otobüs {bus.bus_number}</h4>
                      <p className="text-sm text-slate-500">{bus.plate || 'Plaka yok'} {bus.company ? `• ${bus.company}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingBus(bus); setModalOpen(true); }} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteId(bus.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-xs text-slate-500">Kapasite</p>
                    <p className="font-bold text-slate-700">{bus.capacity}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <p className="text-xs text-emerald-600">Dolu</p>
                    <p className="font-bold text-emerald-700">{count}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2">
                    <p className="text-xs text-amber-600">Boş</p>
                    <p className="font-bold text-amber-700">{bus.capacity - count}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${fillRate >= 100 ? 'bg-rose-500' : fillRate >= 75 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(fillRate, 100)}%` }} />
                  </div>
                  <p className="mt-1 text-right text-xs text-slate-400">%{fillRate} doluluk</p>
                </div>

                <div className="mt-3 space-y-1 text-sm text-slate-500">
                  {bus.driver_name && <p>Şoför: {bus.driver_name} {bus.driver_phone ? `(${bus.driver_phone})` : ''}</p>}
                  {bus.guide_name && <p>Rehber: {bus.guide_name}</p>}
                  {bus.responsible_teacher && <p>Sorumlu: {bus.responsible_teacher}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>{editingBus ? 'Otobüs Düzenle' : 'Yeni Otobüs'}</DialogTitle>
          </DialogHeader>
          {modalOpen && (
            <BusForm trip={trip} bus={editingBus} onSaved={() => { setModalOpen(false); fetchData(); }} onCancel={() => setModalOpen(false)} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Otobüsü Sil"
        description="Bu otobüsü silmek istediğinizden emin misiniz? Koltuk düzeni silinecek ve katılımcıların otobüs ataması kaldırılacaktır."
        confirmText="Evet, Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function BusForm({ trip, bus, onSaved, onCancel }: { trip: Trip; bus: Bus | null; onSaved: () => void; onCancel: () => void }) {
  const { user } = useAuth();
const [form, setForm] = useState({
  bus_number: '',
  plate: '',
  company: '',
  capacity: '50',
  driver_name: '',
  driver_phone: '',
  guide_name: '',
  responsible_teacher: '',
  notes: '',
});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bus) {
      setForm({
        bus_number: bus.bus_number, plate: bus.plate || '', company: bus.company || '',
        capacity: String(bus.capacity), driver_name: bus.driver_name || '',
        driver_phone: bus.driver_phone || '', guide_name: bus.guide_name || '',
        responsible_teacher: bus.responsible_teacher || '', notes: bus.notes || '',
      });
    } else {
      setForm({ bus_number: '1', plate: '', company: '', capacity: '50', driver_name: '', driver_phone: '', guide_name: '', responsible_teacher: '', notes: '' });
    }
  }, [bus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bus_number.trim()) { toast.error('Otobüs numarası zorunludur.'); return; }
    setSaving(true);
    const payload = {
      trip_id: trip.id,
      bus_number: form.bus_number.trim(),
      plate: form.plate || null,
      company: form.company || null,
      capacity: parseInt(form.capacity) || 46,
      driver_name: form.driver_name || null,
      driver_phone: form.driver_phone || null,
      guide_name: form.guide_name || null,
      responsible_teacher: form.responsible_teacher || null,
      notes: form.notes || null,
    };
    if (bus) {
      const { error } = await supabase.from('buses').update(payload).eq('id', bus.id);
      setSaving(false);
      if (error) { toast.error('Güncelleme başarısız: ' + error.message); return; }
      toast.success('Otobüs güncellendi.');
      logActivity(user, 'otobus_duzenle', `Otobüs güncellendi: ${payload.bus_number}`, 'bus', bus.id);
    } else {
      const { data, error } = await supabase.from('buses').insert(payload).select().maybeSingle();
      // Auto-generate seats
      if (data && !error) {
        const seats = [];
        for (let i = 1; i <= payload.capacity; i++) {
          seats.push({ bus_id: data.id, seat_number: i, seat_type: 'empty' });
        }
        await supabase.from('seats').insert(seats);
      }
      setSaving(false);
      if (error) { toast.error('Ekleme başarısız: ' + error.message); return; }
      toast.success('Otobüs eklendi.');
      logActivity(user, 'otobus_ekle', `Yeni otobüs: ${payload.bus_number}`, 'bus', data?.id);
    }
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Otobüs Numarası *</label>
          <input value={form.bus_number} onChange={(e) => setForm({ ...form, bus_number: e.target.value })} className={inputClass} placeholder="1" />
        </div>
<div>
  <label className="mb-1.5 block text-sm font-medium text-slate-700">
    Otobüs Modeli ve Kapasitesi
  </label>

  <select
    value={form.capacity}
    onChange={(e) =>
      setForm({
        ...form,
        capacity: e.target.value,
      })
    }
    className={inputClass}
  >
    <option value="30">
      Otokar Sultan — 30 Kişilik — 2+2
    </option>

    <option value="31">
      Otokar Sultan — 31 Kişilik — 2+2
    </option>

    <option value="50">
      Mercedes-Benz Tourismo — 50 Kişilik — 2+2
    </option>

    <option value="51">
      Mercedes-Benz Tourismo — 51 Kişilik — 2+2
    </option>
  </select>
</div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Plaka</label>
          <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} className={inputClass} placeholder="34 ABC 123" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Otobüs Firması</label>
          <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inputClass} placeholder="Firma adı" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Şoför Adı</label>
          <input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Şoför Telefon</label>
          <input value={form.driver_phone} onChange={(e) => setForm({ ...form, driver_phone: e.target.value })} className={inputClass} placeholder="05XX..." />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Rehber Adı</label>
          <input value={form.guide_name} onChange={(e) => setForm({ ...form, guide_name: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Sorumlu Öğretmen</label>
          <input value={form.responsible_teacher} onChange={(e) => setForm({ ...form, responsible_teacher: e.target.value })} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Notlar</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">İptal</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Kaydediliyor...' : bus ? 'Güncelle' : 'Ekle'}
        </button>
      </div>
    </form>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';