'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bus, Users, Wallet, TrendingUp, TrendingDown, Calendar, Clock,
  CreditCard, UtensilsCrossed, Receipt, Bell, ArrowRight, Activity,
  CheckCircle2, AlertCircle, CircleDollarSign, CalendarClock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { LoadingSpinner } from '@/lib/use-crud';
import { formatCurrency, formatDate, daysUntil } from '@/lib/format';
import { tripStatusLabels } from '@/lib/labels';
import { Trip, Participant, TripPayment, Expense, Reminder, ActivityLog } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tripPayments, setTripPayments] = useState<TripPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [mealPayments, setMealPayments] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [tr, pa, tp, ex, re, al, mp] = await Promise.all([
        supabase.from('trips').select('*').neq('status', 'arsivlendi').order('trip_date', { ascending: true }),
        supabase.from('participants').select('*, trips!inner(price)').neq('status', 'iptal_edildi'),
        supabase.from('trip_payments').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('reminders').select('*').order('reminder_date', { ascending: true }).limit(5),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('meal_payments').select('*'),
      ]);
      if (tr.data) setTrips(tr.data as Trip[]);
      if (pa.data) setParticipants(pa.data as any[]);
      if (tp.data) setTripPayments(tp.data as TripPayment[]);
      if (ex.data) setExpenses(ex.data as Expense[]);
      if (re.data) setReminders(re.data as Reminder[]);
      if (al.data) setActivityLog(al.data as ActivityLog[]);
      if (mp.data) setMealPayments(mp.data as any[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner label="Panel verileri yükleniyor..." />;

  const today = new Date();
  const activeTrips = trips.filter((t) => ['planlaniyor', 'kayit_aliniyor'].includes(t.status));
  const upcomingTrips = trips
    .filter((t) => new Date(t.trip_date) >= today && t.status !== 'iptal_edildi')
    .sort((a, b) => new Date(a.trip_date).getTime() - new Date(b.trip_date).getTime());

  const totalCapacity = trips.reduce((sum, t) => sum + (t.capacity || 0), 0);
  const totalParticipants = participants.length;
  const remainingCapacity = totalCapacity - totalParticipants;

  const collectedTrip = tripPayments.reduce((s, p) => s + Number(p.amount), 0);
  const pendingTrip = participants.reduce((sum, p) => {
    const tripPrice = (p as any).trips?.price || 0;
    const debt = tripPrice - (p.trip_discount || 0) + (p.trip_extra_fee || 0);
    const paid = tripPayments.filter((tp) => tp.participant_id === p.id).reduce((s, x) => s + Number(x.amount), 0);
    return sum + Math.max(0, debt - paid);
  }, 0);

  const collectedMeal = mealPayments.reduce((s, p) => s + Number(p.amount), 0);

  const totalIncome = collectedTrip + collectedMeal;
  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalIncome - totalExpense;

  const recentParticipants = [...participants]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
  const recentPayments = [...tripPayments]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hoş geldiniz, ${user?.full_name?.split(' ')[0] || 'Yönetici'}`}
        description="Okul gezi organizasyonlarınızın genel durumu"
        icon={Activity}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Aktif Gezi" value={activeTrips.length} icon={Bus} variant="blue" />
        <StatCard label="Yaklaşan Gezi" value={upcomingTrips.length} icon={CalendarClock} variant="indigo" />
        <StatCard label="Toplam Katılımcı" value={totalParticipants} icon={Users} variant="emerald" />
        <StatCard label="Toplam Kontenjan" value={totalCapacity} icon={Users} variant="slate" subtitle={`Kalan: ${remainingCapacity}`} />
        <StatCard label="Toplanan Gezi Ücreti" value={formatCurrency(collectedTrip)} icon={CreditCard} variant="emerald" />
        <StatCard label="Bekleyen Gezi Ödemesi" value={formatCurrency(pendingTrip)} icon={Clock} variant="amber" />
        <StatCard label="Toplanan Yemek Ücreti" value={formatCurrency(collectedMeal)} icon={UtensilsCrossed} variant="emerald" />
        <StatCard label="Toplam Gelir" value={formatCurrency(totalIncome)} icon={TrendingUp} variant="emerald" />
        <StatCard label="Toplam Gider" value={formatCurrency(totalExpense)} icon={TrendingDown} variant="rose" />
        <StatCard
          label="Güncel Bakiye"
          value={formatCurrency(balance)}
          icon={Wallet}
          variant={balance >= 0 ? 'emerald' : 'rose'}
        />
      </div>

      {/* Income/Expense summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">Toplam Gelir</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{formatCurrency(totalIncome)}</p>
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            <p>Gezi ödemeleri: {formatCurrency(collectedTrip)}</p>
            <p>Yemek ödemeleri: {formatCurrency(collectedMeal)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-rose-600">
            <TrendingDown className="h-5 w-5" />
            <span className="text-sm font-medium">Toplam Gider</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{formatCurrency(totalExpense)}</p>
          <p className="mt-2 text-xs text-slate-500">{expenses.length} masraf kaydı</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-blue-600">
            <Wallet className="h-5 w-5" />
            <span className="text-sm font-medium">Güncel Bakiye</span>
          </div>
          <p className={`mt-2 text-2xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(balance)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {balance >= 0 ? 'Kar durumu' : 'Zarar durumu'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming trips */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h3 className="font-semibold text-slate-800">Yaklaşan Geziler</h3>
            <Link href="/dashboard/geziler" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Tümü
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {upcomingTrips.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Yaklaşan gezi yok</p>
            ) : (
              upcomingTrips.slice(0, 5).map((trip) => {
                const days = daysUntil(trip.trip_date);
                return (
                  <Link
                    key={trip.id}
                    href={`/dashboard/geziler/${trip.id}`}
                    className="flex items-center justify-between px-5 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{trip.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDate(trip.trip_date)} • {trip.city || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {tripStatusLabels[trip.status]}
                      </span>
                      {days !== null && days >= 0 && (
                        <span className="text-xs font-medium text-slate-500">{days} gün</span>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Recent participants */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h3 className="font-semibold text-slate-800">Son Eklenen Katılımcılar</h3>
            <Link href="/dashboard/katilimcilar" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Tümü
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentParticipants.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Katılımcı yok</p>
            ) : (
              recentParticipants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                    {p.first_name?.charAt(0)}{p.last_name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-slate-500">{p.class_grade || '-'} {p.class_section || ''}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent payments */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h3 className="font-semibold text-slate-800">Son Ödemeler</h3>
            <Link href="/dashboard/odemeler" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Tümü
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentPayments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Ödeme kaydı yok</p>
            ) : (
              recentPayments.map((pay) => (
                <div key={pay.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-slate-600">{formatDate(pay.payment_date)}</span>
                  </div>
                  <span className="font-semibold text-emerald-600">{formatCurrency(pay.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h3 className="font-semibold text-slate-800">Son İşlemler</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {activityLog.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">İşlem kaydı yok</p>
            ) : (
              activityLog.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700">{log.description}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{log.user_name} • {formatDate(log.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upcoming reminders */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="font-semibold text-slate-800">Yaklaşan Hatırlatmalar</h3>
          <Link href="/dashboard/hatirlatmalar" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Tümü
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {reminders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Hatırlatma yok</p>
          ) : (
            reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                  <Bell className="h-4 w-4 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{r.title}</p>
                  {r.description && <p className="truncate text-xs text-slate-500">{r.description}</p>}
                </div>
                <span className="text-xs font-medium text-slate-500">{formatDate(r.reminder_date)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
