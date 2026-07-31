'use client';

import { Bus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useCrud } from '@/lib/use-crud';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Trip, Bus as BusType } from '@/lib/types';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import Link from 'next/link';

export default function BusesPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tripFilter, setTripFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const [tr, bu, pa] = await Promise.all([
        supabase.from('trips').select('*').neq('status', 'arsivlendi').order('trip_date', { ascending: false }),
        supabase.from('buses').select('*, trips!inner(name)').order('created_at', { ascending: false }),
        supabase.from('participants').select('bus_id').neq('status', 'iptal_edildi'),
      ]);
      if (tr.data) setTrips(tr.data as Trip[]);
      if (bu.data) setBuses(bu.data as any[]);
      if (pa.data) {
        const c: Record<string, number> = {};
        pa.data.forEach((p: any) => { if (p.bus_id) c[p.bus_id] = (c[p.bus_id] || 0) + 1; });
        setCounts(c);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = tripFilter === 'all' ? buses : buses.filter((b) => b.trip_id === tripFilter);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Otobüsler" description="Tüm gezilerin otobüslerini görüntüleyin" icon={Bus} />

      <select value={tripFilter} onChange={(e) => setTripFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <option value="all">Tüm Geziler</option>
        {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState message="Otobüs bulunamadı." icon={<Bus className="h-12 w-12" />} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bus) => {
            const count = counts[bus.id] || 0;
            const fillRate = bus.capacity > 0 ? Math.round((count / bus.capacity) * 100) : 0;
            return (
              <Link
                key={bus.id}
                href={`/dashboard/geziler/${bus.trip_id}`}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Bus className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800">Otobüs {bus.bus_number}</h4>
                      <p className="text-xs text-slate-500">{bus.trips?.name}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{bus.plate || '-'}</span>
                  <span className="font-medium text-slate-700">{count}/{bus.capacity}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${fillRate >= 100 ? 'bg-rose-500' : fillRate >= 75 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(fillRate, 100)}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
