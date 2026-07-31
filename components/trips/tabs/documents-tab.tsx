'use client';

import { useState, useEffect } from 'react';
import { FileText, FileDown, Printer, Bus, Users, CreditCard, UtensilsCrossed, CheckSquare, Receipt, MessageCircle, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Trip } from '@/lib/types';
import { tripStatusLabels, participantStatusLabels, paymentStatusLabels, attendanceStatusLabels, expenseCategoryLabels, seatTypeLabels } from '@/lib/labels';
import { LoadingSpinner } from '@/lib/use-crud';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { formatDate, formatTimeShort, formatCurrency } from '@/lib/format';
import { calculateTripPayment, getPaymentStatus, calculateMealPayment } from '@/lib/calculations';
import { toast } from 'sonner';

export function TripDocumentsTab({ trip }: { trip: Trip }) {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [parts, buses, seats, tp, mp, meals, menus, pm, exp, att, staff] = await Promise.all([
        supabase.from('participants').select('*, buses(bus_number), seats(seat_number)').eq('trip_id', trip.id).neq('status', 'iptal_edildi').order('first_name'),
        supabase.from('buses').select('*').eq('trip_id', trip.id).order('bus_number'),
        supabase.from('seats').select('*').eq('bus_id', 'in (...)'),
        supabase.from('trip_payments').select('*, participants(first_name, last_name)').eq('trip_id', trip.id).order('payment_date'),
        supabase.from('meal_payments').select('*').eq('trip_id', trip.id),
        supabase.from('meal_organizations').select('*').eq('trip_id', trip.id),
        supabase.from('meal_menus').select('*, meal_organizations!inner(trip_id)').eq('meal_organizations.trip_id', trip.id),
        supabase.from('participant_meals').select('*, meal_menus(name)').eq('trip_id', trip.id),
        supabase.from('expenses').select('*').eq('trip_id', trip.id).order('expense_date'),
        supabase.from('attendance').select('*').eq('trip_id', trip.id),
        supabase.from('system_users').select('full_name, email, role, phone'),
      ]);
      setData({
        participants: parts.data || [],
        buses: buses.data || [],
        tripPayments: tp.data || [],
        mealPayments: mp.data || [],
        mealOrgs: meals.data || [],
        mealMenus: menus.data || [],
        participantMeals: pm.data || [],
        expenses: exp.data || [],
        attendance: att.data || [],
        staff: staff.data || [],
      });
      setLoading(false);
    })();
  }, [trip.id]);

  const generate = async (type: string) => {
    setGenerating(type);
    try {
      const parts = data.participants || [];
      const fileName = buildFileName([trip.name, type, formatDate(trip.trip_date).replace(/\./g, '-')]);
      const base = { title: trip.name, tripName: trip.name, fileName };

      switch (type) {
        case 'genel_bilgiler': {
          await generatePdf({ ...base, reportName: 'Gezi Genel Bilgileri',
            columns: [{ key: 'label', header: 'Bilgi', width: '40%' }, { key: 'value', header: 'Değer', width: '60%' }],
            rows: [
              { label: 'Gezi Adı', value: trip.name },
              { label: 'Şehir', value: trip.city || '-' },
              { label: 'Tarih', value: formatDate(trip.trip_date) },
              { label: 'Kalkış', value: `${formatDate(trip.departure_date)} ${formatTimeShort(trip.departure_time)}` },
              { label: 'Dönüş', value: `${formatDate(trip.return_date)} ${formatTimeShort(trip.return_time)}` },
              { label: 'Ücret', value: formatCurrency(trip.price) },
              { label: 'Kontenjan', value: String(trip.capacity) },
              { label: 'Durum', value: tripStatusLabels[trip.status] },
              { label: 'Katılımcı', value: String(parts.length) },
            ],
          });
          break;
        }
        case 'katilimci_listesi': {
          await generatePdf({ ...base, reportName: 'Tüm Katılımcı Listesi',
            columns: [
              { key: 'no', header: '#', width: 25, align: 'center' },
              { key: 'name', header: 'Ad Soyad', width: 'auto' },
              { key: 'class', header: 'Sınıf', width: 50 },
              { key: 'phone', header: 'Telefon', width: 80 },
              { key: 'parent', header: 'Veli', width: 'auto' },
            ],
            rows: parts.map((p: any, i: number) => ({
              no: i + 1, name: `${p.first_name} ${p.last_name}`,
              class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
              phone: p.phone || '-', parent: p.parent_name || '-',
            })),
          });
          break;
        }
        case 'sinif_listesi': {
          const byClass: Record<string, any[]> = {};
          parts.forEach((p: any) => {
            const key = `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`;
            if (!byClass[key]) byClass[key] = [];
            byClass[key].push(p);
          });
          const rows: any[] = [];
          Object.entries(byClass).forEach(([cls, list]) => {
            list.forEach((p, i) => rows.push({
              no: i + 1, name: `${p.first_name} ${p.last_name}`, class: cls, phone: p.phone || '-',
            }));
          });
          await generatePdf({ ...base, reportName: 'Sınıfa Göre Katılımcı Listesi',
            columns: [
              { key: 'no', header: '#', width: 25, align: 'center' },
              { key: 'class', header: 'Sınıf', width: 60 },
              { key: 'name', header: 'Ad Soyad', width: 'auto' },
              { key: 'phone', header: 'Telefon', width: 80 },
            ],
            rows,
          });
          break;
        }
        case 'odeme_listesi': {
          const rows = parts.map((p: any, i: number) => {
            const pays = data.tripPayments.filter((tp: any) => tp.participant_id === p.id);
            const calc = calculateTripPayment(p, trip.price, pays);
            return {
              no: i + 1, name: `${p.first_name} ${p.last_name}`,
              debt: formatCurrency(calc.totalDebt), paid: formatCurrency(calc.paid),
              remaining: formatCurrency(calc.remaining),
              status: paymentStatusLabels[getPaymentStatus(calc.totalDebt, calc.paid)],
            };
          });
          await generatePdf({ ...base, reportName: 'Gezi Ödeme Listesi',
            columns: [
              { key: 'no', header: '#', width: 25, align: 'center' },
              { key: 'name', header: 'Ad Soyad', width: 'auto' },
              { key: 'debt', header: 'Borç', width: 70, align: 'right' },
              { key: 'paid', header: 'Ödenen', width: 70, align: 'right' },
              { key: 'remaining', header: 'Kalan', width: 70, align: 'right' },
              { key: 'status', header: 'Durum', width: 60, align: 'center' },
            ],
            rows,
          });
          break;
        }
        case 'eksik_odeme': {
          const rows = parts.filter((p: any) => {
            const pays = data.tripPayments.filter((tp: any) => tp.participant_id === p.id);
            const calc = calculateTripPayment(p, trip.price, pays);
            return calc.remaining > 0;
          }).map((p: any, i: number) => {
            const pays = data.tripPayments.filter((tp: any) => tp.participant_id === p.id);
            const calc = calculateTripPayment(p, trip.price, pays);
            return {
              no: i + 1, name: `${p.first_name} ${p.last_name}`,
              remaining: formatCurrency(calc.remaining),
              status: paymentStatusLabels[getPaymentStatus(calc.totalDebt, calc.paid)],
            };
          });
          await generatePdf({ ...base, reportName: 'Ödemesi Eksik Katılımcılar',
            columns: [
              { key: 'no', header: '#', width: 25, align: 'center' },
              { key: 'name', header: 'Ad Soyad', width: 'auto' },
              { key: 'remaining', header: 'Kalan Borç', width: 80, align: 'right' },
              { key: 'status', header: 'Durum', width: 60, align: 'center' },
            ],
            rows,
          });
          break;
        }
        case 'yoklama': {
          const rows = parts.map((p: any, i: number) => {
            const att = data.attendance.find((a: any) => a.participant_id === p.id);
            return {
              no: i + 1, name: `${p.first_name} ${p.last_name}`,
              class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
              bus: p.buses?.bus_number || '-',
              status: attendanceStatusLabels[(att?.status as keyof typeof attendanceStatusLabels) || 'geldi'],
            };
          });
          await generatePdf({ ...base, reportName: 'Yoklama Listesi',
            columns: [
              { key: 'no', header: '#', width: 25, align: 'center' },
              { key: 'name', header: 'Ad Soyad', width: 'auto' },
              { key: 'class', header: 'Sınıf', width: 50 },
              { key: 'bus', header: 'Otobüs', width: 50 },
              { key: 'status', header: 'Durum', width: 70, align: 'center' },
            ],
            rows,
          });
          break;
        }
        case 'masraf_listesi': {
          await generatePdf({ ...base, reportName: 'Gezi Masraf Listesi',
            columns: [
              { key: 'no', header: '#', width: 25, align: 'center' },
              { key: 'name', header: 'Masraf', width: 'auto' },
              { key: 'category', header: 'Kategori', width: 70 },
              { key: 'amount', header: 'Tutar', width: 70, align: 'right' },
              { key: 'date', header: 'Tarih', width: 60 },
            ],
            rows: (data.expenses || []).map((e: any, i: number) => ({
              no: i + 1, name: e.name, category: expenseCategoryLabels[e.category as keyof typeof expenseCategoryLabels],
              amount: formatCurrency(e.amount), date: formatDate(e.expense_date),
            })),
          });
          break;
        }
        case 'gelir_gider': {
          const collected = data.tripPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
          const mealCollected = data.mealPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
          const totalExp = data.expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
          await generatePdf({ ...base, reportName: 'Gezi Gelir-Gider Raporu',
            columns: [
              { key: 'no', header: '#', width: 25, align: 'center' },
              { key: 'name', header: 'Masraf', width: 'auto' },
              { key: 'category', header: 'Kategori', width: 70 },
              { key: 'amount', header: 'Tutar', width: 70, align: 'right' },
            ],
            rows: data.expenses.map((e: any, i: number) => ({
              no: i + 1, name: e.name, category: expenseCategoryLabels[e.category as keyof typeof expenseCategoryLabels], amount: formatCurrency(e.amount),
            })),
            summaryCards: [
              { label: 'Gezi Geliri', value: formatCurrency(collected) },
              { label: 'Yemek Geliri', value: formatCurrency(mealCollected) },
              { label: 'Toplam Gider', value: formatCurrency(totalExp) },
              { label: 'Bakiye', value: formatCurrency(collected + mealCollected - totalExp) },
            ],
          });
          break;
        }
        case 'sorumlu_listesi': {
          await generatePdf({ ...base, reportName: 'Öğretmen ve Sorumlu Listesi',
            columns: [
              { key: 'no', header: '#', width: 25, align: 'center' },
              { key: 'name', header: 'Ad Soyad', width: 'auto' },
              { key: 'role', header: 'Görev', width: 80 },
              { key: 'email', header: 'E-posta', width: 'auto' },
              { key: 'phone', header: 'Telefon', width: 80 },
            ],
            rows: (data.staff || []).map((s: any, i: number) => ({
              no: i + 1, name: s.full_name,
              role: s.role === 'ana_yonetici' ? 'Ana Yönetici' : s.role === 'gezi_sorumlusu' ? 'Gezi Sorumlusu' : s.role === 'odeme_sorumlusu' ? 'Ödeme Sorumlusu' : 'Yoklama Görevlisi',
              email: s.email, phone: s.phone || '-',
            })),
          });
          break;
        }
        default:
          toast.error('Bu rapor türü henüz desteklenmiyor.');
      }
      toast.success('PDF indirildi.');
    } catch (err: any) {
      toast.error('PDF hatası: ' + err.message);
    }
    setGenerating(null);
  };

  if (loading) return <LoadingSpinner label="Veriler yükleniyor..." />;

  const reports = [
    { key: 'genel_bilgiler', label: 'Gezi Genel Bilgileri', icon: FileText },
    { key: 'katilimci_listesi', label: 'Tüm Katılımcı Listesi', icon: Users },
    { key: 'sinif_listesi', label: 'Sınıfa Göre Katılımcı Listesi', icon: Users },
    { key: 'odeme_listesi', label: 'Gezi Ödeme Listesi', icon: CreditCard },
    { key: 'eksik_odeme', label: 'Ödemesi Eksik Katılımcılar', icon: CreditCard },
    { key: 'yoklama', label: 'Yoklama Listesi', icon: CheckSquare },
    { key: 'masraf_listesi', label: 'Gezi Masraf Listesi', icon: Receipt },
    { key: 'gelir_gider', label: 'Gezi Gelir-Gider Raporu', icon: Receipt },
    { key: 'sorumlu_listesi', label: 'Öğretmen ve Sorumlu Listesi', icon: UserCog },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-700">
          Aşağıdaki raporlar güncel veritabanı verilerinden oluşturulur. Her rapor için PDF indir veya yazdır.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <div key={r.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <r.icon className="h-5 w-5" />
              </div>
              <h4 className="flex-1 text-sm font-medium text-slate-700">{r.label}</h4>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => generate(r.key)}
                disabled={generating === r.key}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <FileDown className="h-3.5 w-3.5" /> {generating === r.key ? 'Oluşturuluyor...' : 'PDF İndir'}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Printer className="h-3.5 w-3.5" /> Yazdır
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
