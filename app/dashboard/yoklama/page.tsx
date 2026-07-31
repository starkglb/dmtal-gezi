'use client';

import { CheckSquare } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trip } from '@/lib/types';
import { LoadingSpinner } from '@/lib/use-crud';
import { TripAttendanceTab } from '@/components/trips/tabs/attendance-tab';

export default function AttendancePage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('trips').select('*').neq('status', 'arsivlendi').order('trip_date', { ascending: false });
      if (data) { setTrips(data as Trip[]); if (data.length > 0) setSelectedTripId(data[0].id); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;
  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  return (
    <div className="space-y-6">
      <PageHeader title="Yoklama" description="Gezi katılımcılarının yoklamasını alın" icon={CheckSquare} />
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-600">Gezi:</label>
        <select value={selectedTripId} onChange={(e) => setSelectedTripId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      {selectedTrip && <TripAttendanceTab trip={selectedTrip} />}
    </div>
  );
}
