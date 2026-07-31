'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Send, Copy, Users, Bus, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Trip, Participant } from '@/lib/types';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { formatCurrency, formatDate, formatTimeShort } from '@/lib/format';
import { toast } from 'sonner';

const variables = [
  '{ad}', '{soyad}', '{ad_soyad}', '{telefon}', '{sinif}', '{gezi_adi}',
  '{gezi_tarihi}', '{kalkis_saati}', '{kalkis_noktasi}', '{gezi_ucreti}',
  '{odenen_tutar}', '{kalan_borc}', '{otobus_no}', '{koltuk_no}',
];

export function TripWhatsappTab({ trip }: { trip: Trip }) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [partRes, histRes] = await Promise.all([
        supabase.from('participants').select('*, buses(bus_number), seats(seat_number)').eq('trip_id', trip.id).neq('status', 'iptal_edildi').order('first_name'),
        supabase.from('whatsapp_messages').select('*').eq('trip_id', trip.id).order('sent_at', { ascending: false }).limit(10),
      ]);
      if (partRes.data) setParticipants(partRes.data as any[]);
      if (histRes.data) setHistory(histRes.data as any[]);
      setLoading(false);
    })();
  }, [trip.id]);

  const fillTemplate = (template: string, p: any) => {
    return template
      .replace(/{ad}/g, p.first_name || '')
      .replace(/{soyad}/g, p.last_name || '')
      .replace(/{ad_soyad}/g, `${p.first_name} ${p.last_name}`)
      .replace(/{telefon}/g, p.phone || '')
      .replace(/{sinif}/g, `${p.class_grade || ''}${p.class_section ? '/' + p.class_section : ''}`)
      .replace(/{gezi_adi}/g, trip.name)
      .replace(/{gezi_tarihi}/g, formatDate(trip.trip_date))
      .replace(/{kalkis_saati}/g, formatTimeShort(trip.departure_time))
      .replace(/{kalkis_noktasi}/g, trip.departure_point || '')
      .replace(/{gezi_ucreti}/g, formatCurrency(trip.price))
      .replace(/{otobus_no}/g, p.buses?.bus_number || '-')
      .replace(/{koltuk_no}/g, p.seats?.seat_number ? String(p.seats.seat_number) : '-');
  };

  const getTargets = () => {
    if (target === 'all') return participants.filter((p) => p.phone);
    if (target === 'selected') return participants.filter((p) => selectedIds.includes(p.id) && p.phone);
    if (target === 'unpaid') return participants.filter((p) => p.phone); // simplified
    return participants.filter((p) => p.phone);
  };

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Mesaj boş olamaz.'); return; }
    const targets = getTargets();
    if (targets.length === 0) { toast.error('Hedef bulunamadı.'); return; }
    // Open WhatsApp with first target's personalized message
    const firstMsg = fillTemplate(message, targets[0]);
    const phone = targets[0].phone?.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(firstMsg)}`, '_blank');
    // Log to history
    const records = targets.slice(0, 1).map((p) => ({
      trip_id: trip.id,
      recipient_name: `${p.first_name} ${p.last_name}`,
      recipient_phone: p.phone,
      message: fillTemplate(message, p),
      status: 'gönderildi',
      sent_by: user?.full_name || null,
    }));
    await supabase.from('whatsapp_messages').insert(records);
    toast.success('WhatsApp açıldı. Mesajı gönderin.');
    // Refresh history
    const { data } = await supabase.from('whatsapp_messages').select('*').eq('trip_id', trip.id).order('sent_at', { ascending: false }).limit(10);
    if (data) setHistory(data as any[]);
  };

  const handleCopy = (p: any) => {
    const msg = fillTemplate(message, p);
    navigator.clipboard.writeText(msg);
    toast.success('Mesaj kopyalandı.');
  };

  if (loading) return <LoadingSpinner label="Yükleniyor..." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Message builder */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="mb-3 font-semibold text-slate-800">Mesaj Oluştur</h4>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Hedef</label>
                <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}>
                  <option value="all">Tüm Katılımcılar</option>
                  <option value="selected">Seçili Katılımcılar</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Hazır Değişkenler</label>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => (
                    <button
                      key={v}
                      onClick={() => setMessage((prev) => prev + ' ' + v)}
                      className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Mesaj</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className={inputClass}
                  placeholder="Merhaba {ad_soyad}, {gezi_adi} gezimize hoş geldiniz..."
                />
              </div>
              <button onClick={handleSend} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                <Send className="h-4 w-4" /> WhatsApp'a Gönder
              </button>
            </div>
          </div>

          {/* History */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="mb-3 font-semibold text-slate-800">Gönderim Geçmişi</h4>
            {history.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Henüz mesaj gönderilmedi.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {history.map((h) => (
                  <div key={h.id} className="rounded-lg bg-slate-50 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{h.recipient_name}</span>
                      <span className="text-xs text-slate-400">{formatDate(h.sent_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{h.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Participants list */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="mb-3 font-semibold text-slate-800">Katılımcılar ({participants.length})</h4>
          {participants.length === 0 ? (
            <EmptyState message="Katılımcı yok." icon={<Users className="h-8 w-8" />} />
          ) : (
            <div className="max-h-[500px] space-y-1.5 overflow-y-auto scrollbar-thin">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5 hover:bg-slate-50">
                  {target === 'selected' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => setSelectedIds((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-slate-400">{p.phone || 'Telefon yok'}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(p)}
                    disabled={!p.phone}
                    className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30"
                    title="Mesajı kopyala"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
