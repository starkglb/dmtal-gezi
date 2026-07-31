'use client';

import { useState, useEffect } from 'react';
import { Receipt, Plus, Pencil, Trash2, FileDown, Download, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Trip, Expense, ExpenseCategory, ExpensePaymentStatus } from '@/lib/types';
import { expenseCategoryLabels, expensePaymentStatusLabels } from '@/lib/labels';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { formatCurrency, formatDate, toDateInputValue } from '@/lib/format';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { exportToExcel } from '@/lib/excel';
import { toast } from 'sonner';

const categoryColors: Record<ExpenseCategory, string> = {
  otobus: 'bg-blue-100 text-blue-700',
  yemek: 'bg-amber-100 text-amber-700',
  muze: 'bg-emerald-100 text-emerald-700',
  rehber: 'bg-purple-100 text-purple-700',
  konaklama: 'bg-indigo-100 text-indigo-700',
  organizasyon: 'bg-rose-100 text-rose-700',
  diger: 'bg-slate-100 text-slate-600',
};

export function TripExpensesTab({ trip }: { trip: Trip }) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tripPayments, setTripPayments] = useState<any[]>([]);
  const [mealPayments, setMealPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [expRes, tpRes, mpRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('trip_id', trip.id).order('expense_date', { ascending: false }),
      supabase.from('trip_payments').select('amount').eq('trip_id', trip.id),
      supabase.from('meal_payments').select('amount').eq('trip_id', trip.id),
    ]);
    if (expRes.data) setExpenses(expRes.data as Expense[]);
    setTripPayments(tpRes.data || []);
    setMealPayments(mpRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [trip.id]);

  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const collectedTrip = tripPayments.reduce((s, p) => s + Number(p.amount), 0);
  const collectedMeal = mealPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalIncome = collectedTrip + collectedMeal;
  const balance = totalIncome - totalExpense;

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('expenses').delete().eq('id', deleteId);
    if (error) { toast.error('Silme başarısız: ' + error.message); }
    else { toast.success('Masraf silindi.'); fetchData(); }
    setDeleteId(null);
  };

  const handlePdf = async () => {
    try {
      await generatePdf({
        title: trip.name,
        reportName: 'Gezi Gelir-Gider Raporu',
        tripName: trip.name,
        columns: [
          { key: 'no', header: '#', width: 25, align: 'center' },
          { key: 'name', header: 'Masraf', width: 'auto' },
          { key: 'category', header: 'Kategori', width: 80 },
          { key: 'date', header: 'Tarih', width: 70 },
          { key: 'amount', header: 'Tutar', width: 70, align: 'right' },
          { key: 'status', header: 'Ödeme', width: 60, align: 'center' },
        ],
        rows: expenses.map((e, i) => ({
          no: i + 1,
          name: e.name,
          category: expenseCategoryLabels[e.category],
          date: formatDate(e.expense_date),
          amount: formatCurrency(e.amount),
          status: expensePaymentStatusLabels[e.payment_status],
        })),
        summaryCards: [
          { label: 'Toplam Gelir', value: formatCurrency(totalIncome) },
          { label: 'Toplam Gider', value: formatCurrency(totalExpense) },
          { label: 'Bakiye', value: formatCurrency(balance) },
        ],
        infoLines: [
          { label: 'Gezi Ödemeleri', value: formatCurrency(collectedTrip) },
          { label: 'Yemek Ödemeleri', value: formatCurrency(collectedMeal) },
        ],
        fileName: buildFileName([trip.name, 'Gelir_Gider', formatDate(trip.trip_date).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) { toast.error('PDF hatası: ' + err.message); }
  };

  const handleExcel = () => {
    exportToExcel(
      [
        { key: 'name', header: 'Masraf' },
        { key: 'category', header: 'Kategori' },
        { key: 'amount', header: 'Tutar' },
        { key: 'date', header: 'Tarih' },
        { key: 'status', header: 'Ödeme Durumu' },
        { key: 'description', header: 'Açıklama' },
      ],
      expenses.map((e) => ({
        name: e.name,
        category: expenseCategoryLabels[e.category],
        amount: e.amount,
        date: formatDate(e.expense_date),
        status: expensePaymentStatusLabels[e.payment_status],
        description: e.description || '',
      })),
      'Masraflar'
    );
    toast.success('Excel indirildi.');
  };

  if (loading) return <LoadingSpinner label="Masraflar yükleniyor..." />;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-600"><TrendingUp className="h-5 w-5" /><span className="text-sm font-medium">Toplam Gelir</span></div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{formatCurrency(totalIncome)}</p>
          <p className="mt-1 text-xs text-slate-500">Gezi: {formatCurrency(collectedTrip)} • Yemek: {formatCurrency(collectedMeal)}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2 text-rose-600"><TrendingDown className="h-5 w-5" /><span className="text-sm font-medium">Toplam Gider</span></div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{formatCurrency(totalExpense)}</p>
          <p className="mt-1 text-xs text-slate-500">{expenses.length} masraf kaydı</p>
        </div>
        <div className={`rounded-xl border p-4 ${balance >= 0 ? 'border-blue-200 bg-blue-50' : 'border-rose-200 bg-rose-50'}`}>
          <div className={`flex items-center gap-2 ${balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}><Wallet className="h-5 w-5" /><span className="text-sm font-medium">Güncel Bakiye</span></div>
          <p className={`mt-2 text-2xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(balance)}</p>
          <p className="mt-1 text-xs text-slate-500">{balance >= 0 ? 'Kar' : 'Zarar'}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <ActionButton onClick={handlePdf} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>Gelir-Gider PDF</ActionButton>
          <ActionButton onClick={handleExcel} variant="outline" icon={<Download className="h-3.5 w-3.5" />}>Excel</ActionButton>
        </div>
        <button onClick={() => { setEditingExpense(null); setModalOpen(true); }} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Masraf Ekle
        </button>
      </div>

      {/* Table */}
      {expenses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState message="Henüz masraf eklenmedi." icon={<Receipt className="h-12 w-12" />} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-3 font-semibold text-slate-600">Masraf</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">Kategori</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Tutar</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">Tarih</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">Durum</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-700">{exp.name}</div>
                      {exp.description && <div className="text-xs text-slate-400">{exp.description}</div>}
                    </td>
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[exp.category]}`}>{expenseCategoryLabels[exp.category]}</span></td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{formatCurrency(exp.amount)}</td>
                    <td className="px-3 py-2.5 text-slate-500">{formatDate(exp.expense_date)}</td>
                    <td className="px-3 py-2.5"><span className="text-xs text-slate-500">{expensePaymentStatusLabels[exp.payment_status]}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingExpense(exp); setModalOpen(true); }} className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteId(exp.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-3 py-3 text-slate-700" colSpan={2}>Toplam</td>
                  <td className="px-3 py-3 text-right text-rose-600">{formatCurrency(totalExpense)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingExpense ? 'Masraf Düzenle' : 'Yeni Masraf'}</DialogTitle></DialogHeader>
          {modalOpen && <ExpenseForm trip={trip} expense={editingExpense} onSaved={() => { setModalOpen(false); fetchData(); }} onCancel={() => setModalOpen(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)} title="Masrafı Sil" description="Bu masraf kaydını silmek istediğinizden emin misiniz?" confirmText="Evet, Sil" onConfirm={handleDelete} />
    </div>
  );
}

function ExpenseForm({ trip, expense, onSaved, onCancel }: { trip: Trip; expense: Expense | null; onSaved: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', category: 'diger' as ExpenseCategory, amount: '0', date: toDateInputValue(new Date()), description: '', status: 'odendi' as ExpensePaymentStatus });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (expense) setForm({ name: expense.name, category: expense.category, amount: String(expense.amount), date: toDateInputValue(expense.expense_date), description: expense.description || '', status: expense.payment_status });
  }, [expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Masraf adı zorunludur.'); return; }
    setSaving(true);
    const payload = {
      trip_id: trip.id, name: form.name.trim(), category: form.category,
      amount: parseFloat(form.amount) || 0, expense_date: form.date,
      description: form.description || null, payment_status: form.status,
    };
    if (expense) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', expense.id);
      setSaving(false);
      if (error) { toast.error('Güncelleme başarısız: ' + error.message); return; }
      toast.success('Masraf güncellendi.');
    } else {
      const { error } = await supabase.from('expenses').insert(payload);
      setSaving(false);
      if (error) { toast.error('Ekleme başarısız: ' + error.message); return; }
      toast.success('Masraf eklendi.');
      logActivity(user, 'masraf_ekle', `Masraf eklendi: ${payload.name}`, 'expense');
    }
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Masraf Adı *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })} className={inputClass}>{Object.entries(expenseCategoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="mb-1 block text-sm font-medium text-slate-700">Tutar (TL)</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} /></div>
        <div><label className="mb-1 block text-sm font-medium text-slate-700">Tarih</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} /></div>
        <div><label className="mb-1 block text-sm font-medium text-slate-700">Ödeme Durumu</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ExpensePaymentStatus })} className={inputClass}>{Object.entries(expensePaymentStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Açıklama</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputClass} /></div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Kaydediliyor...' : expense ? 'Güncelle' : 'Ekle'}</button>
      </div>
    </form>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
