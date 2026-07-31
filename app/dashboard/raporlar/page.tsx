'use client';

import { useState, useEffect } from 'react';
import { BarChart3, FileDown, Download, Printer, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { Trip, Participant, TripPayment, Expense, MealPayment } from '@/lib/types';
import { participantStatusLabels, paymentStatusLabels, expenseCategoryLabels } from '@/lib/labels';
import { calculateTripPayment, getPaymentStatus, getPaymentStatusColor } from '@/lib/calculations';
import { formatCurrency, formatDate } from '@/lib/format';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { exportToExcel } from '@/lib/excel';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [tripPayments, setTripPayments] = useState<TripPayment[]>([]);
  const [mealPayments, setMealPayments] = useState<MealPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filters, setFilters] = useState({
    tripId: 'all', dateFrom: '', dateTo: '', paymentStatus: 'all', classGrade: 'all',
  });

  useEffect(() => {
    (async () => {
      const [tr, pa, tp, mp, ex] = await Promise.all([
        supabase.from('trips').select('*').neq('status', 'arsivlendi').order('trip_date', { ascending: false }),
        supabase.from('participants').select('*, trips!inner(id, name, price), buses(bus_number)').neq('status', 'iptal_edildi'),
        supabase.from('trip_payments').select('*'),
        supabase.from('meal_payments').select('*'),
        supabase.from('expenses').select('*'),
      ]);
      if (tr.data) setTrips(tr.data as Trip[]);
      if (pa.data) setParticipants(pa.data as any[]);
      if (tp.data) setTripPayments(tp.data as TripPayment[]);
      if (mp.data) setMealPayments(mp.data as MealPayment[]);
      if (ex.data) setExpenses(ex.data as Expense[]);
      setLoading(false);
    })();
  }, []);

  const classGrades = Array.from(new Set(participants.map((p) => p.class_grade).filter((v): v is string => Boolean(v))));

  const filteredParts = participants.filter((p) => {
    if (filters.tripId !== 'all' && p.trip_id !== filters.tripId) return false;
    if (filters.classGrade !== 'all' && p.class_grade !== filters.classGrade) return false;
    const pt = trips.find((t) => t.id === p.trip_id) || p.trips;
    const pays = tripPayments.filter((tp) => tp.participant_id === p.id);
    const calc = calculateTripPayment(p, pt?.price || 0, pays);
    const status = getPaymentStatus(calc.totalDebt, calc.paid);
    if (filters.paymentStatus !== 'all' && status !== filters.paymentStatus) return false;
    return true;
  });

  const filteredExpenses = expenses.filter((e) => {
    if (filters.tripId !== 'all' && e.trip_id !== filters.tripId) return false;
    if (filters.dateFrom && new Date(e.expense_date) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(e.expense_date) > new Date(filters.dateTo)) return false;
    return true;
  });

  const totalCollectedTrip = tripPayments
    .filter((tp) => filters.tripId === 'all' || tp.trip_id === filters.tripId)
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalCollectedMeal = mealPayments
    .filter((mp) => filters.tripId === 'all' || mp.trip_id === filters.tripId)
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalExpense = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = totalCollectedTrip + totalCollectedMeal;

  const handlePdf = async () => {
    setGenerating(true);
    try {
      await generatePdf({
        title: filters.tripId !== 'all' ? trips.find((t) => t.id === filters.tripId)?.name || 'Rapor' : 'Tüm Geziler',
        reportName: 'Genel Rapor',
        tripName: filters.tripId !== 'all' ? trips.find((t) => t.id === filters.tripId)?.name : undefined,
        columns: [
          { key: 'no', header: '#', width: 25, align: 'center' },
          { key: 'name', header: 'Ad Soyad', width: 'auto' },
          { key: 'trip', header: 'Gezi', width: 'auto' },
          { key: 'class', header: 'Sınıf', width: 50 },
          { key: 'debt', header: 'Borç', width: 70, align: 'right' },
          { key: 'paid', header: 'Ödenen', width: 70, align: 'right' },
          { key: 'remaining', header: 'Kalan', width: 70, align: 'right' },
          { key: 'status', header: 'Durum', width: 50, align: 'center' },
        ],
        rows: filteredParts.map((p, i) => {
          const pt = trips.find((t) => t.id === p.trip_id) || p.trips;
          const pays = tripPayments.filter((tp) => tp.participant_id === p.id);
          const calc = calculateTripPayment(p, pt?.price || 0, pays);
          return {
            no: i + 1, name: `${p.first_name} ${p.last_name}`, trip: pt?.name || '-',
            class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
            debt: formatCurrency(calc.totalDebt), paid: formatCurrency(calc.paid),
            remaining: formatCurrency(calc.remaining), status: paymentStatusLabels[getPaymentStatus(calc.totalDebt, calc.paid)],
          };
        }),
        summaryCards: [
          { label: 'Katılımcı', value: String(filteredParts.length) },
          { label: 'Gezi Geliri', value: formatCurrency(totalCollectedTrip) },
          { label: 'Yemek Geliri', value: formatCurrency(totalCollectedMeal) },
          { label: 'Toplam Gelir', value: formatCurrency(totalIncome) },
          { label: 'Toplam Gider', value: formatCurrency(totalExpense) },
          { label: 'Bakiye', value: formatCurrency(totalIncome - totalExpense) },
        ],
        fileName: buildFileName(['Genel_Rapor', formatDate(new Date()).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) { toast.error('PDF hatası: ' + err.message); }
    setGenerating(false);
  };

  const handleExcel = () => {
    exportToExcel(
      [
        { key: 'name', header: 'Ad Soyad' },
        { key: 'trip', header: 'Gezi' },
        { key: 'class', header: 'Sınıf' },
        { key: 'debt', header: 'Borç' },
        { key: 'paid', header: 'Ödenen' },
        { key: 'remaining', header: 'Kalan' },
        { key: 'status', header: 'Durum' },
      ],
      filteredParts.map((p) => {
        const pt = trips.find((t) => t.id === p.trip_id) || p.trips;
        const pays = tripPayments.filter((tp) => tp.participant_id === p.id);
        const calc = calculateTripPayment(p, pt?.price || 0, pays);
        return {
          name: `${p.first_name} ${p.last_name}`, trip: pt?.name || '-',
          class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
          debt: calc.totalDebt, paid: calc.paid, remaining: calc.remaining,
          status: paymentStatusLabels[getPaymentStatus(calc.totalDebt, calc.paid)],
        };
      }),
      'Rapor'
    );
    toast.success('Excel indirildi.');
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Raporlar" description="Filtreleyerek rapor oluşturun ve indirin" icon={BarChart3} />

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-slate-700"><Filter className="h-4 w-4" /><span className="font-medium">Filtreler</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Gezi</label>
            <select value={filters.tripId} onChange={(e) => setFilters({ ...filters, tripId: e.target.value })} className={filterClass}>
              <option value="all">Tüm Geziler</option>
              {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Başlangıç</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className={filterClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Bitiş</label>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className={filterClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Sınıf</label>
            <select value={filters.classGrade} onChange={(e) => setFilters({ ...filters, classGrade: e.target.value })} className={filterClass}>
              <option value="all">Tümü</option>
              {classGrades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Ödeme Durumu</label>
            <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className={filterClass}>
              <option value="all">Tümü</option>
              {Object.entries(paymentStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs text-emerald-600">Gezi Geliri</p><p className="mt-1 text-xl font-bold text-slate-800">{formatCurrency(totalCollectedTrip)}</p></div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs text-emerald-600">Yemek Geliri</p><p className="mt-1 text-xl font-bold text-slate-800">{formatCurrency(totalCollectedMeal)}</p></div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-xs text-rose-600">Toplam Gider</p><p className="mt-1 text-xl font-bold text-slate-800">{formatCurrency(totalExpense)}</p></div>
        <div className={`rounded-xl border p-4 ${totalIncome - totalExpense >= 0 ? 'border-blue-200 bg-blue-50' : 'border-rose-200 bg-rose-50'}`}><p className="text-xs text-slate-500">Bakiye</p><p className={`mt-1 text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(totalIncome - totalExpense)}</p></div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <ActionButton onClick={handlePdf} variant="default" icon={<FileDown className="h-3.5 w-3.5" />} loadingText="Oluşturuluyor...">{generating ? 'Oluşturuluyor...' : 'PDF İndir'}</ActionButton>
        <ActionButton onClick={handleExcel} variant="outline" icon={<Download className="h-3.5 w-3.5" />}>Excel</ActionButton>
        <ActionButton onClick={() => window.print()} variant="outline" icon={<Printer className="h-3.5 w-3.5" />}>Yazdır</ActionButton>
      </div>

      {/* Table */}
      {filteredParts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white"><EmptyState message="Filtrelerle eşleşen kayıt yok." icon={<BarChart3 className="h-12 w-12" />} /></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-3 font-semibold text-slate-600">Ad Soyad</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">Gezi</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">Sınıf</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Borç</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Ödenen</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Kalan</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredParts.map((p) => {
                  const pt = trips.find((t) => t.id === p.trip_id) || p.trips;
                  const pays = tripPayments.filter((tp) => tp.participant_id === p.id);
                  const calc = calculateTripPayment(p, pt?.price || 0, pays);
                  const status = getPaymentStatus(calc.totalDebt, calc.paid);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium text-slate-700">{p.first_name} {p.last_name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{pt?.name || '-'}</td>
                      <td className="px-3 py-2.5 text-slate-500">{p.class_grade || '-'}{p.class_section ? '/' + p.class_section : ''}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-slate-700">{formatCurrency(calc.totalDebt)}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-emerald-600">{formatCurrency(calc.paid)}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-rose-600">{formatCurrency(calc.remaining)}</td>
                      <td className="px-3 py-2.5"><span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', getPaymentStatusColor(status))}>{paymentStatusLabels[status]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const filterClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
