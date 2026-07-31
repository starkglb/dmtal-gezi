'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Bus, Info, Users, CreditCard, Armchair, UtensilsCrossed, CheckSquare,
  Receipt, MessageCircle, FileText, ArrowLeft, Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Trip } from '@/lib/types';
import { tripStatusLabels } from '@/lib/labels';
import { LoadingSpinner } from '@/lib/use-crud';
import { cn } from '@/lib/utils';
import { TripGeneralTab } from '@/components/trips/tabs/general-tab';
import { TripParticipantsTab } from '@/components/trips/tabs/participants-tab';
import { TripPaymentsTab } from '@/components/trips/tabs/payments-tab';
import { TripBusesTab } from '@/components/trips/tabs/buses-tab';
import { TripSeatsTab } from '@/components/trips/tabs/seats-tab';
import { TripMealsTab } from '@/components/trips/tabs/meals-tab';
import { TripAttendanceTab } from '@/components/trips/tabs/attendance-tab';
import { TripExpensesTab } from '@/components/trips/tabs/expenses-tab';
import { TripWhatsappTab } from '@/components/trips/tabs/whatsapp-tab';
import { TripDocumentsTab } from '@/components/trips/tabs/documents-tab';

const tabs = [
  { key: 'general', label: 'Genel Bilgiler', icon: Info },
  { key: 'participants', label: 'Katılımcılar', icon: Users },
  { key: 'payments', label: 'Ödemeler', icon: CreditCard },
  { key: 'buses', label: 'Otobüsler', icon: Bus },
  { key: 'seats', label: 'Koltuk Düzeni', icon: Armchair },
  { key: 'meals', label: 'Yemekler', icon: UtensilsCrossed },
  { key: 'attendance', label: 'Yoklama', icon: CheckSquare },
  { key: 'expenses', label: 'Masraflar', icon: Receipt },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'documents', label: 'Belgeler', icon: FileText },
] as const;

type TabKey = (typeof tabs)[number]['key'];

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('trips').select('*').eq('id', params.id).maybeSingle();
      if (data) setTrip(data as Trip);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <LoadingSpinner label="Gezi yükleniyor..." />;
  if (!trip) return <p className="py-12 text-center text-slate-500">Gezi bulunamadı.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push('/dashboard/geziler')}
            className="mt-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">{trip.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {tripStatusLabels[trip.status]}
              </span>
              {trip.city && <span className="text-sm text-slate-500">{trip.city}</span>}
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push(`/dashboard/geziler/${trip.id}/duzenle`)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <Pencil className="h-4 w-4" /> Düzenle
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition',
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'general' && <TripGeneralTab trip={trip} />}
        {activeTab === 'participants' && <TripParticipantsTab trip={trip} />}
        {activeTab === 'payments' && <TripPaymentsTab trip={trip} />}
        {activeTab === 'buses' && <TripBusesTab trip={trip} />}
        {activeTab === 'seats' && <TripSeatsTab trip={trip} />}
        {activeTab === 'meals' && <TripMealsTab trip={trip} />}
        {activeTab === 'attendance' && <TripAttendanceTab trip={trip} />}
        {activeTab === 'expenses' && <TripExpensesTab trip={trip} />}
        {activeTab === 'whatsapp' && <TripWhatsappTab trip={trip} />}
        {activeTab === 'documents' && <TripDocumentsTab trip={trip} />}
      </div>
    </div>
  );
}
