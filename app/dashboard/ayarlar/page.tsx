'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Building, FileText, MessageCircle, Key } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { LoadingSpinner } from '@/lib/use-crud';
import { Settings } from '@/lib/types';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { can } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    system_name: '', logo_url: '', organization_name: '', phone: '', email: '',
    address: '', pdf_header: '', pdf_footer: '', default_currency: 'TL',
    date_format: 'DD.MM.YYYY', whatsapp_enabled: false, whatsapp_api_key: '', whatsapp_sender_phone: '',
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('settings').select('*').maybeSingle();
      if (data) {
        setSettings(data as Settings);
        setForm({
          system_name: data.system_name, logo_url: data.logo_url || '', organization_name: data.organization_name,
          phone: data.phone || '', email: data.email || '', address: data.address || '',
          pdf_header: data.pdf_header, pdf_footer: data.pdf_footer, default_currency: data.default_currency,
          date_format: data.date_format, whatsapp_enabled: data.whatsapp_enabled,
          whatsapp_api_key: data.whatsapp_api_key || '', whatsapp_sender_phone: data.whatsapp_sender_phone || '',
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from('settings').update({
      system_name: form.system_name, logo_url: form.logo_url || null,
      organization_name: form.organization_name, phone: form.phone || null,
      email: form.email || null, address: form.address || null,
      pdf_header: form.pdf_header, pdf_footer: form.pdf_footer,
      default_currency: form.default_currency, date_format: form.date_format,
      whatsapp_enabled: form.whatsapp_enabled, whatsapp_api_key: form.whatsapp_api_key || null,
      whatsapp_sender_phone: form.whatsapp_sender_phone || null,
    }).eq('id', settings.id);
    setSaving(false);
    if (error) { toast.error('Ayarlar kaydedilemedi: ' + error.message); return; }
    toast.success('Ayarlar kaydedildi.');
  };

  if (loading) return <LoadingSpinner />;

  const canEdit = can('settings');

  return (
    <div className="space-y-6">
      <PageHeader title="Ayarlar" description="Sistem ayarlarını yapılandırın" icon={SettingsIcon} />

      <form onSubmit={handleSave} className="space-y-5">
        {/* Organization */}
        <SettingsCard title="Organizasyon Bilgileri" icon={Building}>
          <FormField label="Sistem Adı"><input value={form.system_name} onChange={(e) => setForm({ ...form, system_name: e.target.value })} disabled={!canEdit} className={inputClass} /></FormField>
          <FormField label="Logo URL"><input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} disabled={!canEdit} className={inputClass} placeholder="https://..." /></FormField>
          <FormField label="Organizasyon Adı"><input value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })} disabled={!canEdit} className={inputClass} /></FormField>
          <FormField label="Telefon"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!canEdit} className={inputClass} /></FormField>
          <FormField label="E-posta"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!canEdit} className={inputClass} /></FormField>
          <FormField label="Adres" full><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!canEdit} rows={2} className={inputClass} /></FormField>
        </SettingsCard>

        {/* PDF */}
        <SettingsCard title="PDF Ayarları" icon={FileText}>
          <FormField label="PDF Başlığı"><input value={form.pdf_header} onChange={(e) => setForm({ ...form, pdf_header: e.target.value })} disabled={!canEdit} className={inputClass} /></FormField>
          <FormField label="PDF Alt Bilgisi"><input value={form.pdf_footer} onChange={(e) => setForm({ ...form, pdf_footer: e.target.value })} disabled={!canEdit} className={inputClass} /></FormField>
          <FormField label="Varsayılan Para Birimi"><input value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value })} disabled={!canEdit} className={inputClass} /></FormField>
          <FormField label="Tarih Formatı"><input value={form.date_format} onChange={(e) => setForm({ ...form, date_format: e.target.value })} disabled={!canEdit} className={inputClass} /></FormField>
        </SettingsCard>

        {/* WhatsApp */}
        <SettingsCard title="WhatsApp Ayarları" icon={MessageCircle}>
          <FormField label="WhatsApp Etkin">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.whatsapp_enabled} onChange={(e) => setForm({ ...form, whatsapp_enabled: e.target.checked })} disabled={!canEdit} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
              <span className="text-sm text-slate-600">Etkin</span>
            </label>
          </FormField>
          <FormField label="API Anahtarı"><input value={form.whatsapp_api_key} onChange={(e) => setForm({ ...form, whatsapp_api_key: e.target.value })} disabled={!canEdit} className={inputClass} placeholder="API anahtarı" /></FormField>
          <FormField label="Gönderici Telefon"><input value={form.whatsapp_sender_phone} onChange={(e) => setForm({ ...form, whatsapp_sender_phone: e.target.value })} disabled={!canEdit} className={inputClass} placeholder="05XX..." /></FormField>
        </SettingsCard>

        {canEdit && (
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function SettingsCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function FormField({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? 'sm:col-span-2 lg:col-span-3' : ''}><label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>{children}</div>;
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400';
