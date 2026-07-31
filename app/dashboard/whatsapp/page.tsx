'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Send, Copy, FileText, Users, Clock, Settings as SettingsIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Trip, WhatsappTemplate, WhatsappMessage, ScheduledMessage, SystemUser } from '@/lib/types';
import { roleLabels } from '@/lib/labels';
import { formatDate, formatDateTime, toDateTimeInputValue } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const subTabs = [
  { key: 'send', label: 'Mesaj Gönder', icon: Send },
  { key: 'templates', label: 'Hazır Şablonlar', icon: FileText },
  { key: 'groups', label: 'Gezi Grupları', icon: Users },
  { key: 'contacts', label: 'Kişiler', icon: Users },
  { key: 'scheduled', label: 'Zamanlanmış Mesajlar', icon: Clock },
  { key: 'history', label: 'Gönderim Geçmişi', icon: MessageCircle },
  { key: 'settings', label: 'WhatsApp Ayarları', icon: SettingsIcon },
];

export default function WhatsAppPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('send');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [staff, setStaff] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateModal, setTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsappTemplate | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [tr, tl, msg, sch, st] = await Promise.all([
      supabase.from('trips').select('*').neq('status', 'arsivlendi').order('trip_date', { ascending: false }),
      supabase.from('whatsapp_templates').select('*').order('name'),
      supabase.from('whatsapp_messages').select('*').order('sent_at', { ascending: false }).limit(50),
      supabase.from('scheduled_messages').select('*').order('scheduled_at', { ascending: false }),
      supabase.from('system_users').select('*').order('full_name'),
    ]);
    if (tr.data) setTrips(tr.data as Trip[]);
    if (tl.data) setTemplates(tl.data as WhatsappTemplate[]);
    if (msg.data) setMessages(msg.data as WhatsappMessage[]);
    if (sch.data) setScheduled(sch.data as ScheduledMessage[]);
    if (st.data) setStaff(st.data as SystemUser[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    const { error } = await supabase.from('whatsapp_templates').delete().eq('id', deleteTemplateId);
    if (error) toast.error('Silme başarısız');
    else { toast.success('Şablon silindi.'); fetchData(); }
    setDeleteTemplateId(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp Merkezi" description="Mesaj gönder, şablonları ve gönderim geçmişini yönet" icon={MessageCircle} />

      {/* Sub-tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-thin border-b border-slate-200">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition',
              activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Send tab */}
      {activeTab === 'send' && <SendTab trips={trips} user={user} onSent={fetchData} templates={templates} />}

      {/* Templates tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setEditingTemplate(null); setTemplateModal(true); }} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Yeni Şablon
            </button>
          </div>
          {templates.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white"><EmptyState message="Henüz şablon eklenmedi." icon={<FileText className="h-12 w-12" />} /></div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-slate-800">{t.name}</h4>
                      {t.category && <span className="text-xs text-slate-400">{t.category}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingTemplate(t); setTemplateModal(true); }} className="rounded p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteTemplateId(t.id)} className="rounded p-1 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 whitespace-pre-wrap line-clamp-3">{t.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Groups tab */}
      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /><h4 className="font-semibold text-slate-800">{t.name}</h4></div>
              <p className="mt-2 text-sm text-slate-500">{formatDate(t.trip_date)}</p>
              <p className="text-xs text-slate-400">{t.city || '-'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Contacts tab */}
      {activeTab === 'contacts' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-3 py-3 font-semibold text-slate-600">Ad Soyad</th>
                <th className="px-3 py-3 font-semibold text-slate-600">E-posta</th>
                <th className="px-3 py-3 font-semibold text-slate-600">Telefon</th>
                <th className="px-3 py-3 font-semibold text-slate-600">Rol</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-700">{s.full_name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{s.email}</td>
                    <td className="px-3 py-2.5 text-slate-500">{s.phone || '-'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{roleLabels[s.role]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scheduled tab */}
      {activeTab === 'scheduled' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {scheduled.length === 0 ? (
            <EmptyState message="Zamanlanmış mesaj yok." icon={<Clock className="h-12 w-12" />} />
          ) : (
            <div className="divide-y divide-slate-50">
              {scheduled.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.recipient_name || s.recipient_phone}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(s.scheduled_at)}</p>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-1">{s.message}</p>
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', s.status === 'beklemede' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {messages.length === 0 ? (
            <EmptyState message="Gönderim geçmişi yok." icon={<MessageCircle className="h-12 w-12" />} />
          ) : (
            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto scrollbar-thin">
              {messages.map((m) => (
                <div key={m.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-700">{m.recipient_name || m.recipient_phone}</span>
                      <span className="ml-2 text-xs text-slate-400">{formatDateTime(m.sent_at)}</span>
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', m.status === 'gönderildi' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{m.status}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 whitespace-pre-wrap">{m.message}</p>
                  {m.sent_by && <p className="mt-1 text-xs text-slate-400">Gönderen: {m.sent_by}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="font-semibold text-slate-800">WhatsApp Ayarları</h4>
          <p className="mt-1 text-sm text-slate-500">WhatsApp API entegrasyonu için ayarlar bölümünden yapılandırma yapabilirsiniz.</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
              WhatsApp API entegrasyonu için Ayarlar sayfasından API anahtarınızı ekleyebilirsiniz. Mesajlar şu anda WhatsApp Web üzerinden manuel olarak gönderilir.
            </div>
          </div>
        </div>
      )}

      {/* Template modal */}
      <Dialog open={templateModal} onOpenChange={setTemplateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingTemplate ? 'Şablon Düzenle' : 'Yeni Şablon'}</DialogTitle></DialogHeader>
          {templateModal && <TemplateForm template={editingTemplate} onSaved={() => { setTemplateModal(false); fetchData(); }} onCancel={() => setTemplateModal(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteTemplateId !== null} onOpenChange={(open) => !open && setDeleteTemplateId(null)} title="Şablonu Sil" description="Bu şablonu silmek istediğinizden emin misiniz?" confirmText="Evet, Sil" onConfirm={handleDeleteTemplate} />
    </div>
  );
}

function SendTab({ trips, user, onSent, templates }: any) {
  const [tripId, setTripId] = useState('');
  const [target, setTarget] = useState('all');
  const [message, setMessage] = useState('');
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
    if (trips.length > 0 && !tripId) setTripId(trips[0].id);
  }, [trips]);

  useEffect(() => {
    if (!tripId) return;
    (async () => {
      const { data } = await supabase.from('participants').select('id, first_name, last_name, phone, class_grade, class_section').eq('trip_id', tripId).neq('status', 'iptal_edildi').order('first_name');
      setParticipants(data || []);
    })();
  }, [tripId]);

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Mesaj boş olamaz.'); return; }
    const targets = participants.filter((p) => p.phone);
    if (targets.length === 0) { toast.error('Telefon numarası olan katılımcı yok.'); return; }
    const phone = targets[0].phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    await supabase.from('whatsapp_messages').insert({
      trip_id: tripId || null,
      recipient_name: `${targets[0].first_name} ${targets[0].last_name}`,
      recipient_phone: targets[0].phone,
      message, status: 'gönderildi', sent_by: user?.full_name || null,
    });
    toast.success('WhatsApp açıldı.');
    onSent();
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="mb-3 font-semibold text-slate-800">Mesaj Gönder</h4>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Gezi</label>
            <select value={tripId} onChange={(e) => setTripId(e.target.value)} className={inputClass}>
              {trips.map((t: Trip) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Şablon Seç</label>
            <select onChange={(e) => setMessage(e.target.value)} className={inputClass} defaultValue="">
              <option value="">Boş</option>
              {templates.map((t: WhatsappTemplate) => <option key={t.id} value={t.content}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Mesaj</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} className={inputClass} placeholder="Mesajınızı yazın..." />
          </div>
          <button onClick={handleSend} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            <Send className="h-4 w-4" /> WhatsApp'a Gönder
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="mb-3 font-semibold text-slate-800">Hedef Katılımcılar ({participants.filter((p) => p.phone).length})</h4>
        <div className="max-h-96 space-y-1.5 overflow-y-auto scrollbar-thin">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">{p.first_name} {p.last_name}</p>
                <p className="text-xs text-slate-400">{p.phone || 'Telefon yok'}</p>
              </div>
              {p.phone && (
                <button onClick={() => { navigator.clipboard.writeText(message); toast.success('Kopyalandı'); }} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600">
                  <Copy className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplateForm({ template, onSaved, onCancel }: { template: WhatsappTemplate | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', content: '', category: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) setForm({ name: template.name, content: template.content, category: template.category || '' });
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) { toast.error('Ad ve içerik zorunludur.'); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), content: form.content, category: form.category || null };
    if (template) {
      const { error } = await supabase.from('whatsapp_templates').update(payload).eq('id', template.id);
      setSaving(false);
      if (error) { toast.error('Güncelleme başarısız'); return; }
      toast.success('Şablon güncellendi.');
    } else {
      const { error } = await supabase.from('whatsapp_templates').insert(payload);
      setSaving(false);
      if (error) { toast.error('Ekleme başarısız'); return; }
      toast.success('Şablon eklendi.');
    }
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Şablon Adı *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></div>
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} /></div>
      <div><label className="mb-1 block text-sm font-medium text-slate-700">İçerik *</label><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} className={inputClass} /></div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Kaydediliyor...' : template ? 'Güncelle' : 'Ekle'}</button>
      </div>
    </form>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
