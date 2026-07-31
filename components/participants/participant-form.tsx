'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { logActivity } from '@/lib/activity';
import { Trip, Bus, Participant, ParticipantStatus } from '@/lib/types';
import { participantStatusLabels } from '@/lib/labels';
import { toast } from 'sonner';

interface ParticipantFormProps {
  trip: Trip;
  participant?: Participant | null;
  onSaved: () => void;
  onCancel: () => void;
}

const emptyForm = {
  first_name: '', last_name: '', student_number: '', class_grade: '', class_section: '',
  phone: '', parent_name: '', parent_phone: '', notes: '',
  bus_id: '', status: 'kesin_katiliyor' as ParticipantStatus,
  trip_discount: '0', trip_extra_fee: '0',
};

export function ParticipantForm({ trip, participant, onSaved, onCancel }: ParticipantFormProps) {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('buses').select('*').eq('trip_id', trip.id).order('bus_number');
      if (data) setBuses(data as Bus[]);
    })();
  }, [trip.id]);

  useEffect(() => {
    if (participant) {
      setForm({
        first_name: participant.first_name,
        last_name: participant.last_name,
        student_number: participant.student_number || '',
        class_grade: participant.class_grade || '',
        class_section: participant.class_section || '',
        phone: participant.phone || '',
        parent_name: participant.parent_name || '',
        parent_phone: participant.parent_phone || '',
        notes: participant.notes || '',
        bus_id: participant.bus_id || '',
        status: participant.status,
        trip_discount: String(participant.trip_discount || 0),
        trip_extra_fee: String(participant.trip_extra_fee || 0),
      });
    }
  }, [participant]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('Ad ve soyad zorunludur.');
      return;
    }
    setSaving(true);
    const payload = {
      trip_id: trip.id,
      bus_id: form.bus_id || null,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      student_number: form.student_number || null,
      class_grade: form.class_grade || null,
      class_section: form.class_section || null,
      phone: form.phone || null,
      parent_name: form.parent_name || null,
      parent_phone: form.parent_phone || null,
      notes: form.notes || null,
      status: form.status,
      trip_discount: parseFloat(form.trip_discount) || 0,
      trip_extra_fee: parseFloat(form.trip_extra_fee) || 0,
    };

    if (participant) {
      const { error } = await supabase.from('participants').update(payload).eq('id', participant.id);
      setSaving(false);
      if (error) {
        toast.error('Güncelleme başarısız: ' + error.message);
      } else {
        toast.success('Katılımcı güncellendi.');
        logActivity(user, 'katilimci_duzenle', `Katılımcı güncellendi: ${payload.first_name} ${payload.last_name}`, 'participant', participant.id);
        onSaved();
      }
    } else {
      const { data, error } = await supabase.from('participants').insert(payload).select().maybeSingle();
      setSaving(false);
      if (error) {
        toast.error('Ekleme başarısız: ' + error.message);
      } else {
        toast.success('Katılımcı eklendi.');
        logActivity(user, 'katilimci_ekle', `Yeni katılımcı: ${payload.first_name} ${payload.last_name}`, 'participant', data?.id);
        onSaved();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Ad" required>
          <input value={form.first_name} onChange={(e) => handleChange('first_name', e.target.value)} className={inputClass} placeholder="Ad" />
        </FormField>
        <FormField label="Soyad" required>
          <input value={form.last_name} onChange={(e) => handleChange('last_name', e.target.value)} className={inputClass} placeholder="Soyad" />
        </FormField>
        <FormField label="Öğrenci Numarası">
          <input value={form.student_number} onChange={(e) => handleChange('student_number', e.target.value)} className={inputClass} placeholder="1234" />
        </FormField>
        <FormField label="Sınıf">
          <input value={form.class_grade} onChange={(e) => handleChange('class_grade', e.target.value)} className={inputClass} placeholder="Örn. 9" />
        </FormField>
        <FormField label="Şube">
          <input value={form.class_section} onChange={(e) => handleChange('class_section', e.target.value)} className={inputClass} placeholder="Örn. A" />
        </FormField>
        <FormField label="Telefon">
          <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className={inputClass} placeholder="05XX XXX XX XX" />
        </FormField>
        <FormField label="Veli Adı">
          <input value={form.parent_name} onChange={(e) => handleChange('parent_name', e.target.value)} className={inputClass} placeholder="Veli ad soyad" />
        </FormField>
        <FormField label="Veli Telefon">
          <input value={form.parent_phone} onChange={(e) => handleChange('parent_phone', e.target.value)} className={inputClass} placeholder="05XX XXX XX XX" />
        </FormField>
        <FormField label="Otobüs">
          <select value={form.bus_id} onChange={(e) => handleChange('bus_id', e.target.value)} className={inputClass}>
            <option value="">Otobüs seçilmedi</option>
            {buses.map((b) => (
              <option key={b.id} value={b.id}>{b.bus_number} {b.plate ? `(${b.plate})` : ''}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Katılım Durumu">
          <select value={form.status} onChange={(e) => handleChange('status', e.target.value)} className={inputClass}>
            {Object.entries(participantStatusLabels).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="İndirim (TL)">
          <input type="number" value={form.trip_discount} onChange={(e) => handleChange('trip_discount', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Ek Ücret (TL)">
          <input type="number" value={form.trip_extra_fee} onChange={(e) => handleChange('trip_extra_fee', e.target.value)} className={inputClass} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Özel Notlar">
            <textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={2} className={inputClass} placeholder="Notlar..." />
          </FormField>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          İptal
        </button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Kaydediliyor...' : participant ? 'Güncelle' : 'Ekle'}
        </button>
      </div>
    </form>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
