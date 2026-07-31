'use client';

import { useState, useEffect } from 'react';
import { CheckSquare, FileDown, Download, Check, X, Clock, Bus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Trip, Participant, Attendance, AttendanceStatus } from '@/lib/types';
import { attendanceStatusLabels } from '@/lib/labels';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { exportToExcel } from '@/lib/excel';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusConfig: Record<AttendanceStatus, { color: string; bg: string; icon: any; label: string }> = {
  geldi: { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: Check, label: 'Geldi' },
  gelmedi: { color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', icon: X, label: 'Gelmedi' },
  gec_kaldi: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Clock, label: 'Geç Kaldı' },
  otobuse_bindi: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Bus, label: 'Otobüse Bindi' },
};

export function TripAttendanceTab({ trip }: { trip: Trip }) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [partRes, attRes] = await Promise.all([
        supabase.from('participants').select('id, first_name, last_name, class_grade, class_section, bus_id, buses(bus_number)').eq('trip_id', trip.id).neq('status', 'iptal_edildi').order('first_name'),
        supabase.from('attendance').select('*').eq('trip_id', trip.id),
      ]);
      if (partRes.data) setParticipants(partRes.data as any[]);
      if (attRes.data) {
        const map = new Map<string, AttendanceStatus>();
        attRes.data.forEach((a: any) => map.set(a.participant_id, a.status));
        setAttendance(map);
      }
      setLoading(false);
    })();
  }, [trip.id]);

  const handleSetStatus = async (participantId: string, status: AttendanceStatus) => {
    const existing = attendance.get(participantId);
    if (existing === status) return;
    if (existing) {
      const { error } = await supabase.from('attendance').update({ status }).eq('participant_id', participantId).eq('trip_id', trip.id);
      if (error) { toast.error('Güncelleme başarısız: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('attendance').insert({ participant_id: participantId, trip_id: trip.id, status });
      if (error) { toast.error('Ekleme başarısız: ' + error.message); return; }
    }
    setAttendance((prev) => new Map(prev).set(participantId, status));
  };

  const counts = {
    total: participants.length,
    geldi: 0, gelmedi: 0, gec_kaldi: 0, otobuse_bindi: 0,
  };
  attendance.forEach((s) => { if (s in counts) (counts as any)[s]++; });

  const handlePdf = async () => {
    try {
      await generatePdf({
        title: trip.name,
        reportName: 'Yoklama Listesi',
        tripName: trip.name,
        columns: [
          { key: 'no', header: '#', width: 25, align: 'center' },
          { key: 'name', header: 'Ad Soyad', width: 'auto' },
          { key: 'class', header: 'Sınıf', width: 60 },
          { key: 'bus', header: 'Otobüs', width: 50 },
          { key: 'status', header: 'Durum', width: 80, align: 'center' },
        ],
        rows: participants.map((p, i) => ({
          no: i + 1,
          name: `${p.first_name} ${p.last_name}`,
          class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
          bus: p.buses?.bus_number || '-',
          status: attendanceStatusLabels[attendance.get(p.id) || 'geldi'],
        })),
        summaryCards: [
          { label: 'Toplam', value: String(counts.total) },
          { label: 'Geldi', value: String(counts.geldi) },
          { label: 'Gelmedi', value: String(counts.gelmedi) },
          { label: 'Geç Kaldı', value: String(counts.gec_kaldi) },
          { label: 'Otobüse Bindi', value: String(counts.otobuse_bindi) },
        ],
        fileName: buildFileName([trip.name, 'Yoklama', formatDate(trip.trip_date).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) { toast.error('PDF hatası: ' + err.message); }
  };

  const handleExcel = () => {
    exportToExcel(
      [
        { key: 'name', header: 'Ad Soyad' },
        { key: 'class', header: 'Sınıf' },
        { key: 'bus', header: 'Otobüs' },
        { key: 'status', header: 'Durum' },
      ],
      participants.map((p) => ({
        name: `${p.first_name} ${p.last_name}`,
        class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
        bus: p.buses?.bus_number || '-',
        status: attendanceStatusLabels[attendance.get(p.id) || 'geldi'],
      })),
      'Yoklama'
    );
    toast.success('Excel indirildi.');
  };

  if (loading) return <LoadingSpinner label="Yoklama yükleniyor..." />;

  if (participants.length === 0) {
    return <div className="rounded-xl border border-slate-200 bg-white"><EmptyState message="Katılımcı yok." icon={<CheckSquare className="h-12 w-12" />} /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(['total', 'geldi', 'gelmedi', 'gec_kaldi', 'otobuse_bindi'] as const).map((key) => {
          const label = key === 'total' ? 'Toplam' : attendanceStatusLabels[key];
          return (
            <div key={key} className={cn('rounded-xl border p-3 text-center', key === 'total' ? 'border-slate-200 bg-white' : statusConfig[key as AttendanceStatus]?.bg)}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
              <p className="mt-1 text-2xl font-bold">{(counts as any)[key]}</p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <ActionButton onClick={handlePdf} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>PDF</ActionButton>
        <ActionButton onClick={handleExcel} variant="outline" icon={<Download className="h-3.5 w-3.5" />}>Excel</ActionButton>
      </div>

      {/* Quick attendance list */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-3 py-3 font-semibold text-slate-600">Ad Soyad</th>
                <th className="px-3 py-3 font-semibold text-slate-600">Sınıf</th>
                <th className="px-3 py-3 font-semibold text-slate-600">Otobüs</th>
                <th className="px-3 py-3 font-semibold text-slate-600">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {participants.map((p) => {
                const current = attendance.get(p.id) || 'geldi';
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-700">{p.first_name} {p.last_name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{p.class_grade || '-'}{p.class_section ? '/' + p.class_section : ''}</td>
                    <td className="px-3 py-2.5 text-slate-500">{p.buses?.bus_number || '-'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
                          const cfg = statusConfig[status];
                          const active = current === status;
                          return (
                            <button
                              key={status}
                              onClick={() => handleSetStatus(p.id, status)}
                              className={cn(
                                'flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition',
                                active ? cfg.bg : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                              )}
                            >
                              <cfg.icon className="h-3 w-3" /> {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
