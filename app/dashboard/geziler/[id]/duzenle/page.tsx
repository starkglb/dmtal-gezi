'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Trip } from '@/lib/types';
import { TripForm } from '@/components/trips/trip-form';
import { LoadingSpinner } from '@/lib/use-crud';

export default function EditTripPage() {
  const params = useParams();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('trips').select('*').eq('id', params.id).maybeSingle();
      if (data) setTrip(data as Trip);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <LoadingSpinner label="Gezi yükleniyor..." />;
  if (!trip) return <p className="py-12 text-center text-slate-500">Gezi bulunamadı.</p>;
  return <TripForm trip={trip} />;
}
