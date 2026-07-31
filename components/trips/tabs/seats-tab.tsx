'use client';

import { useState, useEffect } from 'react';
import {
  Bus as BusIcon, FileDown, Printer, Users, Armchair,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Trip, Bus, Seat, Participant, SeatType } from '@/lib/types';
import { seatTypeLabels } from '@/lib/labels';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const seatColors: Record<SeatType, string> = {
  empty: 'bg-white border-slate-200 text-slate-400 hover:border-blue-400',
  reserved: 'bg-amber-50 border-amber-300 text-amber-700',
  teacher: 'bg-indigo-50 border-indigo-300 text-indigo-700',
  staff: 'bg-purple-50 border-purple-300 text-purple-700',
  unavailable: 'bg-slate-200 border-slate-300 text-slate-500 line-through',
  driver: 'bg-slate-700 border-slate-700 text-white',
};

export function TripSeatsTab({ trip }: { trip: Trip }) {
  const { user } = useAuth();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedSeatId, setDraggedSeatId] = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState<Seat | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [busRes, partRes] = await Promise.all([
      supabase.from('buses').select('*').eq('trip_id', trip.id).order('bus_number'),
      supabase.from('participants').select('id, first_name, last_name, class_grade, class_section, bus_id, seat_id, status').eq('trip_id', trip.id),
    ]);
    if (busRes.data) {
      setBuses(busRes.data as Bus[]);
      if (busRes.data.length > 0 && !selectedBusId) {
        setSelectedBusId(busRes.data[0].id);
      }
    }
    if (partRes.data) setParticipants(partRes.data as any[]);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (!selectedBusId) return;
      const { data } = await supabase.from('seats').select('*').eq('bus_id', selectedBusId).order('seat_number');
      if (data) setSeats(data as Seat[]);
    })();
  }, [selectedBusId]);

  useEffect(() => { fetchData(); }, [trip.id]);

  const selectedBus = buses.find((b) => b.id === selectedBusId);

  // Build seat layout: 2+2 with driver section
  // Seats numbered front to back, left-right-left-right pattern
  // Row layout: [1][2] [corridor] [3][4]
  const buildLayout = (seatList: Seat[], capacity: number) => {
    const rows: (Seat | null)[][] = [];
    const seatMap = new Map(seatList.map((s) => [s.seat_number, s]));
    for (let i = 0; i < capacity; i += 4) {
      const row: (Seat | null)[] = [];
      for (let j = 0; j < 4; j++) {
        const num = i + j + 1;
        if (num <= capacity) {
          row.push(seatMap.get(num) || { id: `temp-${num}`, bus_id: selectedBusId, seat_number: num, seat_type: 'empty' as SeatType, participant_id: null, created_at: '' });
        } else {
          row.push(null);
        }
      }
      rows.push(row);
    }
    return rows;
  };

  const layout = selectedBus ? buildLayout(seats, selectedBus.capacity) : [];

  const getParticipant = (id: string | null) => participants.find((p) => p.id === id);

  const handleSeatAction = async (seat: Seat, action: SeatType) => {
    // Clear participant assignment if making non-person seat type
    const update: any = { seat_type: action };
    if (action === 'empty') update.participant_id = null;
    const { error } = await supabase.from('seats').update(update).eq('id', seat.id);
    if (error) { toast.error('İşlem başarısız: ' + error.message); return; }
    // Refresh
    const { data } = await supabase.from('seats').select('*').eq('bus_id', selectedBusId).order('seat_number');
    if (data) setSeats(data as Seat[]);
  };

  const handleClearSeat = async (seat: Seat) => {
    if (seat.participant_id) {
      await supabase.from('participants').update({ seat_id: null }).eq('id', seat.participant_id);
    }
    await supabase.from('seats').update({ seat_type: 'empty', participant_id: null }).eq('id', seat.id);
    const { data } = await supabase.from('seats').select('*').eq('bus_id', selectedBusId).order('seat_number');
    if (data) setSeats(data as Seat[]);
  };

  const handleAssignParticipant = async (seat: Seat, participantId: string) => {
    if (!participantId) { setAssignModal(null); return; }
    // Check if participant already has a seat in this bus
    const existingSeat = seats.find((s) => s.participant_id === participantId);
    if (existingSeat && existingSeat.id !== seat.id) {
      // Clear old seat
      await supabase.from('seats').update({ seat_type: 'empty', participant_id: null }).eq('id', existingSeat.id);
    }
    // Check if target seat has someone
    if (seat.participant_id && seat.participant_id !== participantId) {
      await supabase.from('participants').update({ seat_id: null }).eq('id', seat.participant_id);
    }
    // Assign
    const { error } = await supabase.from('seats').update({ seat_type: 'reserved', participant_id: participantId }).eq('id', seat.id);
    if (error) { toast.error('Atama başarısız: ' + error.message); return; }
    await supabase.from('participants').update({ seat_id: seat.id, bus_id: selectedBusId }).eq('id', participantId);
    toast.success('Katılımcı koltuğa atandı.');
    setAssignModal(null);
    const { data: seatData } = await supabase.from('seats').select('*').eq('bus_id', selectedBusId).order('seat_number');
    if (seatData) setSeats(seatData as Seat[]);
    const { data: partData } = await supabase.from('participants').select('id, first_name, last_name, class_grade, class_section, bus_id, seat_id, status').eq('trip_id', trip.id);
    if (partData) setParticipants(partData as any[]);
  };

  const handleDragStart = (seatId: string) => setDraggedSeatId(seatId);
  const handleDragEnd = () => setDraggedSeatId(null);
  const handleDrop = async (targetSeat: Seat) => {
    if (!draggedSeatId || draggedSeatId === targetSeat.id) return;
    const sourceSeat = seats.find((s) => s.id === draggedSeatId);
    if (!sourceSeat) return;
    // Swap participants
    const sourcePart = sourceSeat.participant_id;
    const targetPart = targetSeat.participant_id;
    // Update source seat
    await supabase.from('seats').update({
      participant_id: targetPart,
      seat_type: targetPart ? 'reserved' : 'empty',
    }).eq('id', sourceSeat.id);
    // Update target seat
    await supabase.from('seats').update({
      participant_id: sourcePart,
      seat_type: sourcePart ? 'reserved' : 'empty',
    }).eq('id', targetSeat.id);
    // Update participants
    if (sourcePart) await supabase.from('participants').update({ seat_id: targetSeat.id }).eq('id', sourcePart);
    if (targetPart) await supabase.from('participants').update({ seat_id: sourceSeat.id }).eq('id', targetPart);
    setDraggedSeatId(null);
    const { data } = await supabase.from('seats').select('*').eq('bus_id', selectedBusId).order('seat_number');
    if (data) setSeats(data as Seat[]);
    toast.success('Koltuklar değiştirildi.');
  };

  const handlePdf = async () => {
    if (!selectedBus) return;
    try {
      const seatRows = layout.flatMap((row, rowIdx) =>
        row.map((seat, colIdx) => {
          const part = seat?.participant_id ? getParticipant(seat.participant_id) : null;
          return {
            row: rowIdx + 1,
            seat: seat ? String(seat.seat_number) : '-',
            position: colIdx < 2 ? 'Sol' : 'Sağ',
            type: seat ? seatTypeLabels[seat.seat_type] : '-',
            person: part ? `${part.first_name} ${part.last_name}` : '-',
            class: part ? `${part.class_grade || ''}${part.class_section ? '/' + part.class_section : ''}` : '-',
          };
        }).filter((r) => r.seat !== '-')
      );
      await generatePdf({
        title: trip.name,
        reportName: `Otobüs ${selectedBus.bus_number} Koltuk Düzeni`,
        tripName: trip.name,
        columns: [
          { key: 'seat', header: 'Koltuk', width: 50, align: 'center' },
          { key: 'position', header: 'Taraf', width: 50, align: 'center' },
          { key: 'type', header: 'Tür', width: 70 },
          { key: 'person', header: 'Kişi', width: 'auto' },
          { key: 'class', header: 'Sınıf', width: 60 },
        ],
        rows: seatRows,
        infoLines: [
          { label: 'Otobüs', value: `${selectedBus.bus_number} ${selectedBus.plate || ''}` },
          { label: 'Kapasite', value: `${selectedBus.capacity} kişi` },
          { label: 'Şoför', value: selectedBus.driver_name || '-' },
          { label: 'Sorumlu', value: selectedBus.responsible_teacher || '-' },
        ],
        fileName: buildFileName([trip.name, `Otobus_${selectedBus.bus_number}`, 'Koltuk_Duzeni', formatDate(trip.trip_date).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) { toast.error('PDF hatası: ' + err.message); }
  };

  if (loading) return <LoadingSpinner label="Otobüsler yükleniyor..." />;

  if (buses.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white">
        <EmptyState message="Önce bir otobüs ekleyin." icon={<BusIcon className="h-12 w-12" />} />
      </div>
    );
  }

  const availableParticipants = participants.filter((p) =>
    p.status !== 'iptal_edildi' && (!p.seat_id || p.bus_id !== selectedBusId)
  );

  return (
    <div className="space-y-4">
      {/* Bus selector + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Otobüs:</label>
          <select value={selectedBusId} onChange={(e) => setSelectedBusId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
            {buses.map((b) => <option key={b.id} value={b.id}>Otobüs {b.bus_number}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={handlePdf} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>PDF</ActionButton>
          <ActionButton onClick={() => window.print()} variant="outline" icon={<Printer className="h-3.5 w-3.5" />}>Yazdır</ActionButton>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
        {(Object.keys(seatTypeLabels) as SeatType[]).map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('h-4 w-4 rounded border', seatColors[type])} />
            <span className="text-slate-600">{seatTypeLabels[type]}</span>
          </div>
        ))}
      </div>

      {/* Bus layout */}
      {selectedBus && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mx-auto max-w-2xl">
            {/* Front / Driver section */}
            <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-100 px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Ön Taraf</span>
              <div className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 text-white">
                <Armchair className="h-4 w-4" />
                <span className="text-xs font-medium">ŞOFÖR</span>
              </div>
            </div>

            {/* Seats */}
            <div className="space-y-2">
              {layout.map((row, rowIdx) => (
                <div key={rowIdx} className="flex items-center justify-center gap-2">
                  {/* Left side: 2 seats */}
                  <div className="flex gap-2">
                    {row.slice(0, 2).map((seat, colIdx) => (
                      <SeatComponent
                        key={colIdx}
                        seat={seat}
                        participant={seat?.participant_id ? getParticipant(seat.participant_id) : null}
                        onAction={handleSeatAction}
                        onClear={handleClearSeat}
                        onAssignClick={setAssignModal}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDrop={handleDrop}
                      />
                    ))}
                  </div>
                  {/* Corridor */}
                  <div className="flex w-12 items-center justify-center">
                    <div className="h-full w-px border-l border-dashed border-slate-300" />
                  </div>
                  {/* Right side: 2 seats */}
                  <div className="flex gap-2">
                    {row.slice(2, 4).map((seat, colIdx) => (
                      <SeatComponent
                        key={colIdx}
                        seat={seat}
                        participant={seat?.participant_id ? getParticipant(seat.participant_id) : null}
                        onAction={handleSeatAction}
                        onClear={handleClearSeat}
                        onAssignClick={setAssignModal}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDrop={handleDrop}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Back */}
            <div className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-center">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Arka Taraf</span>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAssignModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold text-slate-800">Koltuk {assignModal.seat_number} — Katılımcı Ata</h3>
            {availableParticipants.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Atanabilir katılımcı yok.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto scrollbar-thin">
                {availableParticipants.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAssignParticipant(assignModal, p.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">{p.first_name} {p.last_name}</span>
                    <span className="text-xs text-slate-400">{p.class_grade || '-'}{p.class_section ? '/' + p.class_section : ''}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button onClick={() => setAssignModal(null)} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeatComponent({
  seat, participant, onAction, onClear, onAssignClick, onDragStart, onDragEnd, onDrop,
}: {
  seat: Seat | null;
  participant: any;
  onAction: (seat: Seat, type: SeatType) => void;
  onClear: (seat: Seat) => void;
  onAssignClick: (seat: Seat) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (seat: Seat) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!seat) return <div className="h-14 w-14" />;

  const isOccupied = seat.seat_type !== 'empty' && seat.seat_type !== 'driver';

  return (
    <div
      draggable={isOccupied}
      onDragStart={() => onDragStart(seat.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(seat)}
      onClick={() => setMenuOpen(!menuOpen)}
      className={cn(
        'relative flex h-14 w-14 cursor-pointer flex-col items-center justify-center rounded-lg border-2 text-center transition-all',
        seatColors[seat.seat_type],
        isOccupied && 'hover:shadow-md'
      )}
      title={participant ? `${participant.first_name} ${participant.last_name}` : seatTypeLabels[seat.seat_type]}
    >
      <span className="text-xs font-bold">{seat.seat_number}</span>
      {participant && (
        <span className="truncate px-1 text-[9px] leading-tight">{participant.first_name?.charAt(0)}{participant.last_name?.charAt(0)}</span>
      )}

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
          <div className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { onAssignClick(seat); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
              <Users className="h-3.5 w-3.5" /> Katılımcı Ata
            </button>
            {seat.participant_id && (
              <button onClick={() => { onClear(seat); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                <Armchair className="h-3.5 w-3.5" /> Koltuğu Boşalt
              </button>
            )}
            <div className="border-t border-slate-100">
              <button onClick={() => { onAction(seat, 'teacher'); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">Öğretmen Koltuğu</button>
              <button onClick={() => { onAction(seat, 'staff'); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">Sorumlu Koltuğu</button>
              <button onClick={() => { onAction(seat, 'reserved'); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">Rezerve Et</button>
              <button onClick={() => { onAction(seat, 'unavailable'); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">Kullanılamaz</button>
              <button onClick={() => { onAction(seat, 'empty'); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">Boş Koltuk</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
