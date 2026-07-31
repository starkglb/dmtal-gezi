'use client';

import { Bus, MapPin, Calendar, Clock, Users, Wallet, FileText, Check, X, User } from 'lucide-react';
import { Trip } from '@/lib/types';
import { formatCurrency, formatDate, formatTimeShort } from '@/lib/format';
import { tripStatusLabels } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { StatCard } from '@/components/shared/stat-card';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { ActionButton } from '@/components/shared/action-button';
import { toast } from 'sonner';
import { FileDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function TripGeneralTab({ trip }: { trip: Trip }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({ participants: 0, collected: 0, buses: 0 });

  useEffect(() => {
    (async () => {
      const [p, pay, b] = await Promise.all([
        supabase.from('participants').select('id, trip_discount, trip_extra_fee').eq('trip_id', trip.id).neq('status', 'iptal_edildi'),
        supabase.from('trip_payments').select('amount').eq('trip_id', trip.id),
        supabase.from('buses').select('id').eq('trip_id', trip.id),
      ]);
      const collected = (pay.data || []).reduce((s: number, x: any) => s + Number(x.amount), 0);
      setStats({
        participants: p.data?.length || 0,
        collected,
        buses: b.data?.length || 0,
      });
    })();
  }, [trip.id]);

  const handlePdf = async () => {
    try {
      const [parts, buses, payments, expenses] = await Promise.all([
        supabase.from('participants').select('*, buses(bus_number)').eq('trip_id', trip.id).order('created_at'),
        supabase.from('buses').select('*').eq('trip_id', trip.id).order('bus_number'),
        supabase.from('trip_payments').select('*, participants(first_name, last_name)').eq('trip_id', trip.id).order('payment_date'),
        supabase.from('expenses').select('*').eq('trip_id', trip.id).order('expense_date'),
      ]);

      const collected = (payments.data || []).reduce((s: number, x: any) => s + Number(x.amount), 0);
      const totalExpense = (expenses.data || []).reduce((s: number, x: any) => s + Number(x.amount), 0);

      await generatePdf({
        title: trip.name,
        reportName: 'Gezi Genel Bilgileri',
        tripName: trip.name,
        columns: [
          { key: 'label', header: 'Bilgi', width: '40%' },
          { key: 'value', header: 'Değer', width: '60%' },
        ],
        rows: [
          { label: 'Gezi Adı', value: trip.name },
          { label: 'Şehir', value: trip.city || '-' },
          { label: 'Gidilecek Yerler', value: trip.places || '-' },
          { label: 'Gezi Tarihi', value: formatDate(trip.trip_date) },
          { label: 'Kalkış Tarihi', value: formatDate(trip.departure_date) },
          { label: 'Kalkış Saati', value: formatTimeShort(trip.departure_time) },
          { label: 'Dönüş Tarihi', value: formatDate(trip.return_date) },
          { label: 'Dönüş Saati', value: formatTimeShort(trip.return_time) },
          { label: 'Kalkış Noktası', value: trip.departure_point || '-' },
          { label: 'Gezi Ücreti', value: formatCurrency(trip.price) },
          { label: 'Kontenjan', value: String(trip.capacity) },
          { label: 'Son Kayıt Tarihi', value: formatDate(trip.registration_deadline) },
          { label: 'Gezi Sorumlusu', value: trip.responsible_person || '-' },
          { label: 'Durum', value: tripStatusLabels[trip.status] },
          { label: 'Katılımcı Sayısı', value: String(stats.participants) },
          { label: 'Otobüs Sayısı', value: String(stats.buses) },
          { label: 'Toplanan Ücret', value: formatCurrency(collected) },
          { label: 'Toplam Gider', value: formatCurrency(totalExpense) },
        ],
        infoLines: [
          { label: 'Açıklama', value: trip.description || '-' },
          { label: 'Dahil Olan Hizmetler', value: trip.included_services || '-' },
          { label: 'Hariç Olan Hizmetler', value: trip.excluded_services || '-' },
          { label: 'Özel Notlar', value: trip.private_notes || '-' },
        ],
        fileName: buildFileName([trip.name, 'Genel_Bilgiler', formatDate(trip.trip_date).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) {
      toast.error('PDF oluşturulamadı: ' + err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <ActionButton onClick={handlePdf} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>
          PDF İndir
        </ActionButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Katılımcı" value={stats.participants} icon={Users} variant="blue" subtitle={`Kontenjan: ${trip.capacity}`} />
        <StatCard label="Toplanan Ücret" value={formatCurrency(stats.collected)} icon={Wallet} variant="emerald" />
        <StatCard label="Otobüs" value={stats.buses} icon={Bus} variant="indigo" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <InfoCard title="Gezi Bilgileri" icon={Bus}>
          <InfoRow icon={MapPin} label="Şehir" value={trip.city} />
          <InfoRow icon={MapPin} label="Gidilecek Yerler" value={trip.places} />
          <InfoRow icon={Calendar} label="Gezi Tarihi" value={formatDate(trip.trip_date)} />
          <InfoRow icon={Calendar} label="Kalkış Tarihi" value={formatDate(trip.departure_date)} />
          <InfoRow icon={Clock} label="Kalkış Saati" value={formatTimeShort(trip.departure_time)} />
          <InfoRow icon={Calendar} label="Dönüş Tarihi" value={formatDate(trip.return_date)} />
          <InfoRow icon={Clock} label="Dönüş Saati" value={formatTimeShort(trip.return_time)} />
          <InfoRow icon={MapPin} label="Kalkış Noktası" value={trip.departure_point} />
          <InfoRow icon={User} label="Gezi Sorumlusu" value={trip.responsible_person} />
          <InfoRow icon={Wallet} label="Gezi Ücreti" value={formatCurrency(trip.price)} />
          <InfoRow icon={Users} label="Kontenjan" value={String(trip.capacity)} />
          <InfoRow icon={Calendar} label="Son Kayıt" value={formatDate(trip.registration_deadline)} />
        </InfoCard>

        <div className="space-y-5">
          <InfoCard title="Açıklama" icon={FileText}>
            <p className="text-sm leading-relaxed text-slate-600">{trip.description || 'Açıklama yok.'}</p>
          </InfoCard>
          <InfoCard title="Dahil Olan Hizmetler" icon={Check}>
            <p className="text-sm leading-relaxed text-slate-600">{trip.included_services || 'Belirtilmemiş.'}</p>
          </InfoCard>
          <InfoCard title="Hariç Olan Hizmetler" icon={X}>
            <p className="text-sm leading-relaxed text-slate-600">{trip.excluded_services || 'Belirtilmemiş.'}</p>
          </InfoCard>
          <InfoCard title="Gezi Programı" icon={Calendar}>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-600">{trip.program || 'Program belirtilmemiş.'}</pre>
          </InfoCard>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-50 py-2 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <span className="w-32 shrink-0 text-sm text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{value || '-'}</span>
    </div>
  );
}
