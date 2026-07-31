'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, CreditCard, FileDown, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Trip, Participant, TripPayment, PaymentMethod, PaymentStatus } from '@/lib/types';
import { paymentMethodLabels, paymentStatusLabels } from '@/lib/labels';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { calculateTripPayment, getPaymentStatus, getPaymentStatusColor } from '@/lib/calculations';
import { formatCurrency, formatDate, toDateInputValue } from '@/lib/format';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { exportToExcel } from '@/lib/excel';
import { toast } from 'sonner';

interface PaymentsTableProps {
  trip?: Trip;
  fixedTripId?: string;
}

export function PaymentsTable({ trip, fixedTripId }: PaymentsTableProps) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<any[]>([]);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ participant: any } | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [historyModal, setHistoryModal] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [partRes, payRes, tripRes] = await Promise.all([
      supabase.from('participants').select('*, trips!inner(id, name, price)').neq('status', 'iptal_edildi').order('first_name'),
      supabase.from('trip_payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('trips').select('*').neq('status', 'arsivlendi'),
    ]);
    if (partRes.data) setParticipants(partRes.data as any[]);
    if (payRes.data) setPayments(payRes.data as TripPayment[]);
    if (tripRes.data) setTrips(tripRes.data as Trip[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredParticipants = fixedTripId
    ? participants.filter((p) => p.trip_id === fixedTripId)
    : participants;

  const rows = filteredParticipants.map((p) => {
    const pt = trips.find((t) => t.id === p.trip_id) || p.trips;
    const tripPrice = pt?.price || 0;
    const pPayments = payments.filter((pay) => pay.participant_id === p.id);
    const calc = calculateTripPayment(p, tripPrice, pPayments);
    const status = getPaymentStatus(calc.totalDebt, calc.paid);
    return { ...p, tripName: pt?.name || '-', ...calc, payStatus: status, payments: pPayments };
  });

  const totalDebt = rows.reduce((s, r) => s + r.totalDebt, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);
  const fullPaid = rows.filter((r) => r.payStatus === 'odendi' || r.payStatus === 'ucretsiz').length;
  const partial = rows.filter((r) => r.payStatus === 'kismi_odeme').length;
  const unpaid = rows.filter((r) => r.payStatus === 'odenmedi').length;

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;
    const { error } = await supabase.from('trip_payments').delete().eq('id', deletePaymentId);
    if (error) { toast.error('Silme başarısız: ' + error.message); }
    else { toast.success('Ödeme silindi.'); fetchData(); }
    setDeletePaymentId(null);
  };

  const handlePdf = async (filterType?: 'all' | 'unpaid' | 'paid') => {
    let data = rows;
    let reportName = 'Gezi Ödeme Listesi';
    if (filterType === 'unpaid') {
      data = rows.filter((r) => r.payStatus === 'odenmedi' || r.payStatus === 'kismi_odeme');
      reportName = 'Ödemesi Eksik Katılımcılar';
    } else if (filterType === 'paid') {
      data = rows.filter((r) => r.payStatus === 'odendi' || r.payStatus === 'ucretsiz');
      reportName = 'Tam Ödeme Yapan Katılımcılar';
    }
    try {
      await generatePdf({
        title: trip?.name || 'Tüm Geziler',
        reportName,
        tripName: trip?.name,
        columns: [
          { key: 'no', header: '#', width: 25, align: 'center' },
          { key: 'name', header: 'Ad Soyad', width: 'auto' },
          { key: 'class', header: 'Sınıf', width: 60 },
          { key: 'debt', header: 'Borç', width: 70, align: 'right' },
          { key: 'paid', header: 'Ödenen', width: 70, align: 'right' },
          { key: 'remaining', header: 'Kalan', width: 70, align: 'right' },
          { key: 'status', header: 'Durum', width: 60, align: 'center' },
        ],
        rows: data.map((p, i) => ({
          no: i + 1,
          name: `${p.first_name} ${p.last_name}`,
          class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
          debt: formatCurrency(p.totalDebt),
          paid: formatCurrency(p.paid),
          remaining: formatCurrency(p.remaining),
          status: paymentStatusLabels[p.payStatus as PaymentStatus],
        })),
        summaryCards: [
          { label: 'Toplam Kişi', value: String(data.length) },
          { label: 'Toplam Borç', value: formatCurrency(data.reduce((s, p) => s + p.totalDebt, 0)) },
          { label: 'Toplanan', value: formatCurrency(data.reduce((s, p) => s + p.paid, 0)) },
          { label: 'Kalan', value: formatCurrency(data.reduce((s, p) => s + p.remaining, 0)) },
        ],
        fileName: buildFileName([trip?.name || 'Odeme', reportName, formatDate(new Date()).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) { toast.error('PDF hatası: ' + err.message); }
  };

  const handleExportExcel = () => {
    exportToExcel(
      [
        { key: 'name', header: 'Ad Soyad' },
        { key: 'class', header: 'Sınıf' },
        { key: 'tripName', header: 'Gezi' },
        { key: 'totalDebt', header: 'Toplam Borç' },
        { key: 'paid', header: 'Ödenen' },
        { key: 'remaining', header: 'Kalan' },
        { key: 'payStatus', header: 'Ödeme Durumu' },
      ],
      rows.map((p) => ({
        name: `${p.first_name} ${p.last_name}`,
        class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
        tripName: p.tripName,
        totalDebt: p.totalDebt,
        paid: p.paid,
        remaining: p.remaining,
        payStatus: paymentStatusLabels[p.payStatus as PaymentStatus],
      })),
      'Gezi_Odemeleri'
    );
    toast.success('Excel indirildi.');
  };

  if (loading) return <LoadingSpinner label="Ödemeler yükleniyor..." />;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryBox label="Toplam Borç" value={formatCurrency(totalDebt)} color="slate" />
        <SummaryBox label="Toplanan" value={formatCurrency(totalPaid)} color="emerald" />
        <SummaryBox label="Kalan" value={formatCurrency(totalRemaining)} color="rose" />
        <SummaryBox label="Ödemesi Eksik" value={`${unpaid + partial} kişi`} color="amber" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={() => handlePdf('all')} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>Tümü PDF</ActionButton>
        <ActionButton onClick={() => handlePdf('unpaid')} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>Eksik Ödemeler PDF</ActionButton>
        <ActionButton onClick={() => handlePdf('paid')} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>Tam Ödemeler PDF</ActionButton>
        <ActionButton onClick={handleExportExcel} variant="outline" icon={<Download className="h-3.5 w-3.5" />}>Excel</ActionButton>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState message="Ödeme kaydı bulunamadı." icon={<CreditCard className="h-12 w-12" />} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-3 font-semibold text-slate-600">Ad Soyad</th>
                  {!fixedTripId && <th className="px-3 py-3 font-semibold text-slate-600">Gezi</th>}
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Borç</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Ödenen</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Kalan</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">Durum</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-700">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-slate-400">{p.class_grade || '-'}{p.class_section ? '/' + p.class_section : ''}</div>
                    </td>
                    {!fixedTripId && <td className="px-3 py-2.5 text-slate-500">{p.tripName}</td>}
                    <td className="px-3 py-2.5 text-right font-medium text-slate-700">{formatCurrency(p.totalDebt)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-emerald-600">{formatCurrency(p.paid)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-rose-600">{formatCurrency(p.remaining)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getPaymentStatusColor(p.payStatus)}`}>
                        {paymentStatusLabels[p.payStatus as PaymentStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPaymentModal({ participant: p })}
                          className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                        >
                          <Plus className="h-3 w-3" /> Ödeme
                        </button>
                        {p.payments.length > 0 && (
                          <button
                            onClick={() => setHistoryModal(p)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title="Ödeme geçmişi"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment modal */}
      <Dialog open={!!paymentModal} onOpenChange={(open) => !open && setPaymentModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ödeme Ekle — {paymentModal?.participant.first_name} {paymentModal?.participant.last_name}</DialogTitle>
          </DialogHeader>
          {paymentModal && (
            <PaymentForm
              participant={paymentModal.participant}
              remaining={paymentModal.participant.remaining}
              onSaved={() => { setPaymentModal(null); fetchData(); }}
              onCancel={() => setPaymentModal(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* History modal */}
      <Dialog open={!!historyModal} onOpenChange={(open) => !open && setHistoryModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ödeme Geçmişi — {historyModal?.first_name} {historyModal?.last_name}</DialogTitle>
          </DialogHeader>
          {historyModal && (
            <div className="space-y-2">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Toplam Borç:</span><span className="font-medium">{formatCurrency(historyModal.totalDebt)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Ödenen:</span><span className="font-medium text-emerald-600">{formatCurrency(historyModal.paid)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Kalan:</span><span className="font-medium text-rose-600">{formatCurrency(historyModal.remaining)}</span></div>
              </div>
              <div className="max-h-60 overflow-y-auto scrollbar-thin">
                {historyModal.payments.map((pay: TripPayment) => (
                  <div key={pay.id} className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{formatCurrency(pay.amount)}</p>
                      <p className="text-xs text-slate-400">{formatDate(pay.payment_date)} • {paymentMethodLabels[pay.payment_method]}</p>
                      {pay.description && <p className="text-xs text-slate-400">{pay.description}</p>}
                    </div>
                    <button onClick={() => { setDeletePaymentId(pay.id); }} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletePaymentId !== null}
        onOpenChange={(open) => !open && setDeletePaymentId(null)}
        title="Ödemeyi Sil"
        description="Bu ödeme kaydını silmek istediğinizden emin misiniz?"
        confirmText="Evet, Sil"
        onConfirm={handleDeletePayment}
      />
    </div>
  );
}

function PaymentForm({ participant, remaining, onSaved, onCancel }: { participant: any; remaining: number; onSaved: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(String(remaining > 0 ? remaining : 0));
  const [paymentDate, setPaymentDate] = useState(toDateInputValue(new Date()));
  const [method, setMethod] = useState<PaymentMethod>('nakit');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Geçerli bir tutar girin.'); return; }
    setSaving(true);
    const { error } = await supabase.from('trip_payments').insert({
      participant_id: participant.id,
      trip_id: participant.trip_id,
      amount: amt,
      payment_date: paymentDate,
      payment_method: method,
      description: description || null,
      recorded_by: user?.full_name || null,
    });
    setSaving(false);
    if (error) { toast.error('Ödeme eklenemedi: ' + error.message); return; }
    toast.success('Ödeme eklendi.');
    logActivity(user, 'odeme_ekle', `Ödeme eklendi: ${participant.first_name} ${participant.last_name} - ${formatCurrency(amt)}`, 'payment');
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Kalan Borç:</span><span className="font-bold text-rose-600">{formatCurrency(remaining)}</span></div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Tutar (TL)</label>
        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Tarih</label>
        <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Ödeme Yöntemi</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputClass}>
          {Object.entries(paymentMethodLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Açıklama</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="İsteğe bağlı" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">İptal</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Ekleniyor...' : 'Ödeme Ekle'}
        </button>
      </div>
    </form>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    slate: 'border-slate-200 bg-white text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
