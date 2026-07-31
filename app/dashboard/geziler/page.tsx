'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bus, Plus, Search, Copy, Archive, MoreVertical, MapPin, Calendar, Users, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { formatCurrency, formatDate } from '@/lib/format';
import { tripStatusLabels } from '@/lib/labels';
import { Trip, TripStatus } from '@/lib/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const statusColors: Record<TripStatus, string> = {
  taslak: 'bg-slate-100 text-slate-600',
  planlaniyor: 'bg-blue-100 text-blue-700',
  kayit_aliniyor: 'bg-emerald-100 text-emerald-700',
  kontenjan_doldu: 'bg-amber-100 text-amber-700',
  tamamlandi: 'bg-indigo-100 text-indigo-700',
  iptal_edildi: 'bg-rose-100 text-rose-700',
  arsivlendi: 'bg-slate-200 text-slate-500',
};

export default function TripsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const fetchTrips = async () => {
    setLoading(true);
    let query = supabase.from('trips').select('*').order('trip_date', { ascending: false });
    if (!showArchived) {
      query = query.neq('status', 'arsivlendi');
    }
    const { data } = await query;
    if (data) {
      setTrips(data as Trip[]);
      // Get participant counts
      const { data: parts } = await supabase.from('participants').select('trip_id');
      const counts: Record<string, number> = {};
      (parts || []).forEach((p: any) => {
        counts[p.trip_id] = (counts[p.trip_id] || 0) + 1;
      });
      setParticipantCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrips();
  }, [showArchived]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('trips').delete().eq('id', deleteId);
    if (error) {
      toast.error('Gezi silinemedi: ' + error.message);
    } else {
      toast.success('Gezi silindi.');
      logActivity(user, 'gezi_sil', 'Gezi silindi', 'trip', deleteId);
      fetchTrips();
    }
    setDeleteId(null);
  };

  const handleArchive = async (id: string) => {
    const { error } = await supabase.from('trips').update({ status: 'arsivlendi' }).eq('id', id);
    if (error) {
      toast.error('Arşivleme başarısız: ' + error.message);
    } else {
      toast.success('Gezi arşivlendi.');
      logActivity(user, 'gezi_arsivle', 'Gezi arşivlendi', 'trip', id);
      fetchTrips();
    }
    setMenuOpen(null);
  };

  const handleCopy = async (trip: Trip) => {
    const { id, created_at, updated_at, ...rest } = trip;
    const { data, error } = await supabase
      .from('trips')
      .insert({ ...rest, name: `${trip.name} (Kopya)`, status: 'taslak' as TripStatus })
      .select()
      .maybeSingle();
    if (error) {
      toast.error('Kopyalama başarısız: ' + error.message);
    } else {
      toast.success('Gezi kopyalandı.');
      logActivity(user, 'gezi_kopyala', `Gezi kopyalandı: ${trip.name}`, 'trip', data?.id);
      fetchTrips();
    }
    setMenuOpen(null);
  };

  const filtered = trips.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.city || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Geziler"
        description="Okul gezilerini oluşturun ve yönetin"
        icon={Bus}
        actions={
          <Button onClick={() => router.push('/dashboard/geziler/yeni')} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Yeni Gezi
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Gezi adı veya şehir ara..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">Tüm Durumlar</option>
          {Object.entries(tripStatusLabels).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Arşivleri göster
        </label>
      </div>

      {loading ? (
        <LoadingSpinner label="Geziler yükleniyor..." />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState message={search ? 'Aramanızla eşleşen gezi bulunamadı.' : 'Henüz gezi oluşturulmadı.'} icon={<Bus className="h-12 w-12" />} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((trip) => {
            const count = participantCounts[trip.id] || 0;
            const fillRate = trip.capacity > 0 ? Math.round((count / trip.capacity) * 100) : 0;
            return (
              <div
                key={trip.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {trip.poster_url && (
                  <div className="h-32 w-full overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={trip.poster_url} alt={trip.name} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/dashboard/geziler/${trip.id}`} className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-slate-800 hover:text-blue-600">{trip.name}</h3>
                    </Link>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[trip.status]}`}>
                      {tripStatusLabels[trip.status]}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm text-slate-500">
                    {trip.city && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span>{trip.city}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{formatDate(trip.trip_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span>{count} / {trip.capacity} katılımcı</span>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${fillRate >= 100 ? 'bg-rose-500' : fillRate >= 75 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(fillRate, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-800">{formatCurrency(trip.price)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/dashboard/geziler/${trip.id}/duzenle`)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === trip.id ? null : trip.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuOpen === trip.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                            <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                              <button
                                onClick={() => handleCopy(trip)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                              >
                                <Copy className="h-4 w-4" /> Kopyala
                              </button>
                              <button
                                onClick={() => handleArchive(trip.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                              >
                                <Archive className="h-4 w-4" /> Arşivle
                              </button>
                              <button
                                onClick={() => { setDeleteId(trip.id); setMenuOpen(null); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-4 w-4" /> Sil
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Geziyi Sil"
        description="Bu geziyi silmek istediğinizden emin misiniz? Geziye ait tüm katılımcılar, ödemeler, otobüsler ve diğer veriler kalıcı olarak silinecek. Bu işlem geri alınamaz."
        confirmText="Evet, Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}
