'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, Download, Upload, FileDown, Printer, Users, X, CheckSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Trip, Participant, TripPayment, ParticipantStatus, PaymentStatus } from '@/lib/types';
import { participantStatusLabels, paymentStatusLabels } from '@/lib/labels';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ParticipantForm } from '@/components/participants/participant-form';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { calculateTripPayment, getPaymentStatus, getPaymentStatusColor } from '@/lib/calculations';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportToExcel, exportToCsv, parseImportFile, getFieldValue } from '@/lib/excel';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { toast } from 'sonner';

interface ParticipantsTableProps {
  trip?: Trip;
  fixedTripId?: string;
}

export function ParticipantsTable({ trip, fixedTripId }: ParticipantsTableProps) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    tripId: fixedTripId || 'all',
    classGrade: 'all',
    classSection: 'all',
    status: 'all',
    paymentStatus: 'all',
    busId: 'all',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    const [partRes, payRes, tripRes, busRes] = await Promise.all([
      supabase.from('participants').select('*, trips!inner(id, name, price), buses(id, bus_number)').neq('status', 'iptal_edildi').order('created_at', { ascending: false }),
      supabase.from('trip_payments').select('*'),
      supabase.from('trips').select('*').neq('status', 'arsivlendi').order('trip_date', { ascending: false }),
      supabase.from('buses').select('id, bus_number, trip_id'),
    ]);
    if (partRes.data) setParticipants(partRes.data as any[]);
    if (payRes.data) setPayments(payRes.data as TripPayment[]);
    if (tripRes.data) setTrips(tripRes.data as Trip[]);
    if (busRes.data) {
      const map = new Map<string, any>();
      busRes.data.forEach((b: any) => map.set(b.id, b));
      setBuses(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const classGrades = Array.from(new Set(participants.map((p) => p.class_grade).filter((v): v is string => Boolean(v))));
  const classSections = Array.from(new Set(participants.map((p) => p.class_section).filter((v): v is string => Boolean(v))));
  const tripBuses = buses.size > 0 ? Array.from(buses.values()) : [];

  const getParticipantTrip = (p: any): Trip | undefined => trips.find((t) => t.id === p.trip_id) || (p.trips as any);

  const getRowData = (p: any) => {
    const pt = getParticipantTrip(p);
    const tripPrice = pt?.price || 0;
    const pPayments = payments.filter((pay) => pay.participant_id === p.id);
    const calc = calculateTripPayment(p as any, tripPrice, pPayments);
    const status = getPaymentStatus(calc.totalDebt, calc.paid);
    return { ...p, tripName: pt?.name || '-', tripPrice, ...calc, payStatus: status };
  };

  const allRows = participants.map(getRowData);

  const filtered = allRows.filter((p) => {
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    const matchesSearch = !search || fullName.includes(search.toLowerCase()) || (p.student_number || '').includes(search);
    const matchesTrip = filters.tripId === 'all' || p.trip_id === filters.tripId;
    const matchesClass = filters.classGrade === 'all' || p.class_grade === filters.classGrade;
    const matchesSection = filters.classSection === 'all' || p.class_section === filters.classSection;
    const matchesStatus = filters.status === 'all' || p.status === filters.status;
    const matchesPayment = filters.paymentStatus === 'all' || p.payStatus === filters.paymentStatus;
    const matchesBus = filters.busId === 'all' || p.bus_id === filters.busId;
    return matchesSearch && matchesTrip && matchesClass && matchesSection && matchesStatus && matchesPayment && matchesBus;
  });

  const handleAdd = () => {
    setEditingParticipant(null);
    setModalOpen(true);
  };

  const handleEdit = (p: Participant) => {
    setEditingParticipant(p);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('participants').delete().eq('id', deleteId);
    if (error) {
      toast.error('Silme başarısız: ' + error.message);
    } else {
      toast.success('Katılımcı silindi.');
      logActivity(user, 'katilimci_sil', 'Katılımcı silindi', 'participant', deleteId);
      fetchData();
    }
    setDeleteId(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const { error } = await supabase.from('participants').delete().in('id', Array.from(selected));
    if (error) {
      toast.error('Toplu silme başarısız: ' + error.message);
    } else {
      toast.success(`${selected.size} katılımcı silindi.`);
      setSelected(new Set());
      fetchData();
    }
  };

  const handleExportExcel = () => {
    exportToExcel(
      [
        { key: 'first_name', header: 'Ad' },
        { key: 'last_name', header: 'Soyad' },
        { key: 'student_number', header: 'Öğrenci No' },
        { key: 'class_grade', header: 'Sınıf' },
        { key: 'class_section', header: 'Şube' },
        { key: 'phone', header: 'Telefon' },
        { key: 'parent_name', header: 'Veli Adı' },
        { key: 'parent_phone', header: 'Veli Telefon' },
        { key: 'tripName', header: 'Gezi' },
        { key: 'trip_total_debt', header: 'Toplam Borç' },
        { key: 'trip_paid', header: 'Ödenen' },
        { key: 'trip_remaining', header: 'Kalan' },
        { key: 'payStatus', header: 'Ödeme Durumu' },
        { key: 'status', header: 'Katılım Durumu' },
      ],
      filtered.map((p) => ({
        ...p,
        payStatus: paymentStatusLabels[p.payStatus as PaymentStatus],
        status: participantStatusLabels[p.status as ParticipantStatus],
        trip_total_debt: p.totalDebt,
        trip_paid: p.paid,
        trip_remaining: p.remaining,
      })),
      'Katilimcilar'
    );
    toast.success('Excel indirildi.');
  };

  const handleExportCsv = () => {
    exportToCsv(
      [
        { key: 'first_name', header: 'Ad' },
        { key: 'last_name', header: 'Soyad' },
        { key: 'student_number', header: 'Öğrenci No' },
        { key: 'class_grade', header: 'Sınıf' },
        { key: 'class_section', header: 'Şube' },
        { key: 'phone', header: 'Telefon' },
        { key: 'parent_name', header: 'Veli Adı' },
        { key: 'parent_phone', header: 'Veli Telefon' },
        { key: 'tripName', header: 'Gezi' },
        { key: 'status', header: 'Katılım Durumu' },
      ],
      filtered.map((p) => ({
        ...p,
        status: participantStatusLabels[p.status as ParticipantStatus],
      })),
      'Katilimcilar'
    );
    toast.success('CSV indirildi.');
  };

  const handlePdf = async () => {
    try {
      await generatePdf({
        title: trip?.name || 'Tüm Geziler',
        reportName: 'Katılımcı Listesi',
        tripName: trip?.name,
        columns: [
          { key: 'no', header: '#', width: 25, align: 'center' },
          { key: 'name', header: 'Ad Soyad', width: 'auto' },
          { key: 'class', header: 'Sınıf', width: 60, align: 'center' },
          { key: 'phone', header: 'Telefon', width: 90 },
          { key: 'parent', header: 'Veli', width: 'auto' },
          { key: 'debt', header: 'Borç', width: 70, align: 'right' },
          { key: 'paid', header: 'Ödenen', width: 70, align: 'right' },
          { key: 'remaining', header: 'Kalan', width: 70, align: 'right' },
          { key: 'payStatus', header: 'Ödeme', width: 60, align: 'center' },
        ],
        rows: filtered.map((p, i) => ({
          no: i + 1,
          name: `${p.first_name} ${p.last_name}`,
          class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
          phone: p.phone || '-',
          parent: p.parent_name || '-',
          debt: formatCurrency(p.totalDebt),
          paid: formatCurrency(p.paid),
          remaining: formatCurrency(p.remaining),
          payStatus: paymentStatusLabels[p.payStatus as PaymentStatus],
        })),
        summaryCards: [
          { label: 'Toplam Katılımcı', value: String(filtered.length) },
          { label: 'Toplam Borç', value: formatCurrency(filtered.reduce((s, p) => s + p.totalDebt, 0)) },
          { label: 'Toplanan', value: formatCurrency(filtered.reduce((s, p) => s + p.paid, 0)) },
          { label: 'Kalan', value: formatCurrency(filtered.reduce((s, p) => s + p.remaining, 0)) },
        ],
        fileName: buildFileName([trip?.name || 'Katilimcilar', 'Listesi', formatDate(new Date()).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) {
      toast.error('PDF oluşturulamadı: ' + err.message);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseImportFile(file);
      if (rows.length === 0) {
        toast.error('Dosyada veri bulunamadı.');
        return;
      }
      if (!fixedTripId && filters.tripId === 'all') {
        toast.error('İçe aktarma için önce bir gezi seçin.');
        return;
      }
      const targetTripId = fixedTripId || filters.tripId;
      const targetTrip = trips.find((t) => t.id === targetTripId);
      if (!targetTrip) {
        toast.error('Hedef gezi bulunamadı.');
        return;
      }
      let success = 0;
      let failed = 0;
      for (const row of rows) {
        const first_name = getFieldValue(row, ['ad', 'first_name', 'isim', 'name', 'ad soyad']);
        const last_name = getFieldValue(row, ['soyad', 'last_name', 'surname']);
        if (!first_name && !last_name) { failed++; continue; }
        const payload: any = {
          trip_id: targetTripId,
          first_name: first_name || '-',
          last_name: last_name || '-',
          student_number: getFieldValue(row, ['öğrenci no', 'student_number', 'ogrenci no', 'no']) || null,
          class_grade: getFieldValue(row, ['sınıf', 'class_grade', 'sinif', 'sınıfı']) || null,
          class_section: getFieldValue(row, ['şube', 'class_section', 'sube']) || null,
          phone: getFieldValue(row, ['telefon', 'phone', 'telefon numarası']) || null,
          parent_name: getFieldValue(row, ['veli adı', 'veli', 'parent_name', 'veli adi', 'veli ad soyad']) || null,
          parent_phone: getFieldValue(row, ['veli telefon', 'parent_phone', 'veli telefonu', 'veli telefon numarası']) || null,
          status: 'kesin_katiliyor',
        };
        const { error } = await supabase.from('participants').insert(payload);
        if (error) failed++; else success++;
      }
      toast.success(`${success} katılımcı içe aktarıldı.${failed > 0 ? ` ${failed} kayıt başarısız.` : ''}`);
      logActivity(user, 'katilimci_ice_aktar', `${success} katılımcı içe aktarıldı`, 'participant');
      setImportOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error('İçe aktarma hatası: ' + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) return <LoadingSpinner label="Katılımcılar yükleniyor..." />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim veya numara ara..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <ActionButton onClick={handlePdf} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>PDF</ActionButton>
        <ActionButton onClick={handleExportExcel} variant="outline" icon={<Download className="h-3.5 w-3.5" />}>Excel</ActionButton>
        <ActionButton onClick={handleExportCsv} variant="outline" icon={<Download className="h-3.5 w-3.5" />}>CSV</ActionButton>
        <ActionButton onClick={() => fileInputRef.current?.click()} variant="outline" icon={<Upload className="h-3.5 w-3.5" />}>İçe Aktar</ActionButton>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
        <button onClick={handleAdd} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Katılımcı Ekle
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {!fixedTripId && (
          <select value={filters.tripId} onChange={(e) => setFilters({ ...filters, tripId: e.target.value })} className={filterClass}>
            <option value="all">Tüm Geziler</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <select value={filters.classGrade} onChange={(e) => setFilters({ ...filters, classGrade: e.target.value })} className={filterClass}>
          <option value="all">Tüm Sınıflar</option>
          {classGrades.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.classSection} onChange={(e) => setFilters({ ...filters, classSection: e.target.value })} className={filterClass}>
          <option value="all">Tüm Şubeler</option>
          {classSections.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.busId} onChange={(e) => setFilters({ ...filters, busId: e.target.value })} className={filterClass}>
          <option value="all">Tüm Otobüsler</option>
          {tripBuses.map((b: any) => <option key={b.id} value={b.id}>{b.bus_number}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={filterClass}>
          <option value="all">Katılım Durumu</option>
          {Object.entries(participantStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className={filterClass}>
          <option value="all">Ödeme Durumu</option>
          {Object.entries(paymentStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
          <CheckSquare className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">{selected.size} katılımcı seçildi</span>
          <button onClick={handleBulkDelete} className="ml-auto text-sm font-medium text-rose-600 hover:text-rose-700">Toplu Sil</button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-slate-500 hover:text-slate-700">İptal</button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState message={search ? 'Aramanızla eşleşen katılımcı bulunamadı.' : 'Henüz katılımcı eklenmedi.'} icon={<Users className="h-12 w-12" />} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold text-slate-600">Ad Soyad</th>
                  {!fixedTripId && <th className="px-3 py-3 font-semibold text-slate-600">Gezi</th>}
                  <th className="px-3 py-3 font-semibold text-slate-600">Sınıf</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">Telefon</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Borç</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Ödenen</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Kalan</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">Ödeme</th>
                  <th className="px-3 py-3 font-semibold text-slate-600">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-700">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-slate-400">{p.student_number || '-'}</div>
                    </td>
                    {!fixedTripId && <td className="px-3 py-2.5 text-slate-500">{p.tripName}</td>}
                    <td className="px-3 py-2.5 text-slate-500">{p.class_grade || '-'}{p.class_section ? `/${p.class_section}` : ''}</td>
                    <td className="px-3 py-2.5 text-slate-500">{p.phone || '-'}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-700">{formatCurrency(p.totalDebt)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-emerald-600">{formatCurrency(p.paid)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-rose-600">{formatCurrency(p.remaining)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getPaymentStatusColor(p.payStatus)}`}>
                        {paymentStatusLabels[p.payStatus as PaymentStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(p)} className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteId(p.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>{editingParticipant ? 'Katılımcı Düzenle' : 'Yeni Katılımcı'}</DialogTitle>
          </DialogHeader>
          {modalOpen && (
            <ParticipantForm
              trip={trip || trips.find((t) => t.id === filters.tripId) || trips[0]}
              participant={editingParticipant}
              onSaved={() => { setModalOpen(false); fetchData(); }}
              onCancel={() => setModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Katılımcıyı Sil"
        description="Bu katılımcıyı silmek istediğinizden emin misiniz? Katılımcıya ait ödeme kayıtları da silinecek. Bu işlem geri alınamaz."
        confirmText="Evet, Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}

const filterClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
