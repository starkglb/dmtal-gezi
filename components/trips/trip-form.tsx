'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bus, Save, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { logActivity } from '@/lib/activity';
import { Trip, TripStatus } from '@/lib/types';
import { tripStatusLabels } from '@/lib/labels';
import { toDateInputValue } from '@/lib/format';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface TripFormProps {
  trip?: Trip;
}

const emptyForm = {
  name: '', city: '', places: '', description: '', poster_url: '',
  trip_date: '', departure_date: '', departure_time: '', return_date: '', return_time: '',
  departure_point: '', price: '0', capacity: '0', registration_deadline: '',
  program: '', included_services: '', excluded_services: '', private_notes: '',
  responsible_person: '', status: 'taslak' as TripStatus,
};

export function TripForm({ trip }: TripFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (trip) {
      setForm({
        name: trip.name || '',
        city: trip.city || '',
        places: trip.places || '',
        description: trip.description || '',
        poster_url: trip.poster_url || '',
        trip_date: toDateInputValue(trip.trip_date),
        departure_date: toDateInputValue(trip.departure_date),
        departure_time: trip.departure_time || '',
        return_date: toDateInputValue(trip.return_date),
        return_time: trip.return_time || '',
        departure_point: trip.departure_point || '',
        price: String(trip.price || 0),
        capacity: String(trip.capacity || 0),
        registration_deadline: toDateInputValue(trip.registration_deadline),
        program: trip.program || '',
        included_services: trip.included_services || '',
        excluded_services: trip.excluded_services || '',
        private_notes: trip.private_notes || '',
        responsible_person: trip.responsible_person || '',
        status: trip.status,
      });
    }
  }, [trip]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Gezi adı zorunludur.');
      return;
    }
    if (!form.trip_date) {
      toast.error('Gezi tarihi zorunludur.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      city: form.city || null,
      places: form.places || null,
      description: form.description || null,
      poster_url: form.poster_url || null,
      trip_date: form.trip_date,
      departure_date: form.departure_date || null,
      departure_time: form.departure_time || null,
      return_date: form.return_date || null,
      return_time: form.return_time || null,
      departure_point: form.departure_point || null,
      price: parseFloat(form.price) || 0,
      capacity: parseInt(form.capacity) || 0,
      registration_deadline: form.registration_deadline || null,
      program: form.program || null,
      included_services: form.included_services || null,
      excluded_services: form.excluded_services || null,
      private_notes: form.private_notes || null,
      responsible_person: form.responsible_person || null,
      status: form.status,
    };

    if (trip) {
      const { error } = await supabase.from('trips').update(payload).eq('id', trip.id);
      setSaving(false);
      if (error) {
        toast.error('Güncelleme başarısız: ' + error.message);
      } else {
        toast.success('Gezi güncellendi.');
        logActivity(user, 'gezi_duzenle', `Gezi güncellendi: ${payload.name}`, 'trip', trip.id);
        router.push(`/dashboard/geziler/${trip.id}`);
      }
    } else {
      const { data, error } = await supabase.from('trips').insert(payload).select().maybeSingle();
      setSaving(false);
      if (error) {
        toast.error('Oluşturma başarısız: ' + error.message);
      } else {
        toast.success('Gezi oluşturuldu.');
        logActivity(user, 'gezi_olustur', `Yeni gezi oluşturuldu: ${payload.name}`, 'trip', data?.id);
        router.push(`/dashboard/geziler/${data?.id}`);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Geri
        </button>
        <Button type="submit" disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : trip ? 'Güncelle' : 'Geziyi Oluştur'}
        </Button>
      </div>

      {/* Genel Bilgiler */}
      <FormSection title="Genel Bilgiler" icon={Bus}>
        <Field label="Gezi Adı" required>
          <Input value={form.name} onChange={(v) => handleChange('name', v)} placeholder="Örn. Edirne Kültür Gezisi" />
        </Field>
        <Field label="Gidilecek Şehir">
          <Input value={form.city} onChange={(v) => handleChange('city', v)} placeholder="Örn. Edirne" />
        </Field>
        <Field label="Gezi Afişi (Görsel URL)">
          <Input value={form.poster_url} onChange={(v) => handleChange('poster_url', v)} placeholder="https://..." />
        </Field>
        <Field label="Gidilecek Yerler">
          <Input value={form.places} onChange={(v) => handleChange('places', v)} placeholder="Örn. Selimiye Camii, Meriç Köprüsü" />
        </Field>
        <Field label="Gezi Açıklaması" full>
          <Textarea value={form.description} onChange={(v) => handleChange('description', v)} rows={3} placeholder="Gezi hakkında genel bilgi..." />
        </Field>
        <Field label="Gezi Durumu">
          <SelectInput value={form.status} onChange={(v) => handleChange('status', v)} options={tripStatusLabels} />
        </Field>
        <Field label="Gezi Sorumlusu">
          <Input value={form.responsible_person} onChange={(v) => handleChange('responsible_person', v)} placeholder="Sorumlu öğretmen" />
        </Field>
      </FormSection>

      {/* Tarih ve Saat */}
      <FormSection title="Tarih ve Saat">
        <Field label="Gezi Tarihi" required>
          <DateInput value={form.trip_date} onChange={(v) => handleChange('trip_date', v)} />
        </Field>
        <Field label="Son Kayıt Tarihi">
          <DateInput value={form.registration_deadline} onChange={(v) => handleChange('registration_deadline', v)} />
        </Field>
        <Field label="Kalkış Tarihi">
          <DateInput value={form.departure_date} onChange={(v) => handleChange('departure_date', v)} />
        </Field>
        <Field label="Kalkış Saati">
          <Input value={form.departure_time} onChange={(v) => handleChange('departure_time', v)} placeholder="04.00" />
        </Field>
        <Field label="Tahmini Dönüş Tarihi">
          <DateInput value={form.return_date} onChange={(v) => handleChange('return_date', v)} />
        </Field>
        <Field label="Tahmini Dönüş Saati">
          <Input value={form.return_time} onChange={(v) => handleChange('return_time', v)} placeholder="22.00" />
        </Field>
        <Field label="Kalkış Noktası" full>
          <Input value={form.departure_point} onChange={(v) => handleChange('departure_point', v)} placeholder="Örn. Okul önü" />
        </Field>
      </FormSection>

      {/* Ücret ve Kontenjan */}
      <FormSection title="Ücret ve Kontenjan">
        <Field label="Gezi Ücreti (TL)">
          <Input value={form.price} onChange={(v) => handleChange('price', v)} type="number" />
        </Field>
        <Field label="Toplam Kontenjan">
          <Input value={form.capacity} onChange={(v) => handleChange('capacity', v)} type="number" />
        </Field>
      </FormSection>

      {/* Program ve Hizmetler */}
      <FormSection title="Program ve Hizmetler">
        <Field label="Gezi Programı" full>
          <Textarea value={form.program} onChange={(v) => handleChange('program', v)} rows={5} placeholder="Saat saat gezi programı..." />
        </Field>
        <Field label="Dahil Olan Hizmetler" full>
          <Textarea value={form.included_services} onChange={(v) => handleChange('included_services', v)} rows={3} placeholder="Ulaşım, rehber, müze giriş ücretleri..." />
        </Field>
        <Field label="Hariç Olan Hizmetler" full>
          <Textarea value={form.excluded_services} onChange={(v) => handleChange('excluded_services', v)} rows={3} placeholder="Kişisel harcamalar, ek içecekler..." />
        </Field>
        <Field label="Özel Notlar" full>
          <Textarea value={form.private_notes} onChange={(v) => handleChange('private_notes', v)} rows={2} placeholder="Yönetici notları..." />
        </Field>
      </FormSection>

      <div className="flex justify-end gap-3 pb-6">
        <Button type="button" variant="outline" onClick={() => router.back()}>İptal</Button>
        <Button type="submit" disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : trip ? 'Güncelle' : 'Geziyi Oluştur'}
        </Button>
      </div>
    </form>
  );
}

// Form helper components
function FormSection({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-blue-600" />}
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Input value={value} onChange={onChange} type="date" />;
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Record<string, string> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    >
      {Object.entries(options).map(([val, label]) => (
        <option key={val} value={val}>{label}</option>
      ))}
    </select>
  );
}
