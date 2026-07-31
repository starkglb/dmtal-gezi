'use client';

import { useState, useEffect } from 'react';
import {
  UtensilsCrossed, Plus, Pencil, Trash2, FileDown, Download, Copy,
  MessageCircle, Users, Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Trip, MealOrganization, MealMenu, ParticipantMeal, MealPayment, PaymentMethod, PaymentStatus } from '@/lib/types';
import { paymentMethodLabels, paymentStatusLabels } from '@/lib/labels';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ActionButton } from '@/components/shared/action-button';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { calculateMealPayment, getPaymentStatus, getPaymentStatusColor } from '@/lib/calculations';
import { formatCurrency, formatDate, formatTimeShort, toDateInputValue } from '@/lib/format';
import { generatePdf, buildFileName } from '@/lib/pdf';
import { exportToExcel } from '@/lib/excel';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function TripMealsTab({ trip }: { trip: Trip }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<MealOrganization[]>([]);
  const [menus, setMenus] = useState<MealMenu[]>([]);
  const [participantMeals, setParticipantMeals] = useState<any[]>([]);
  const [mealPayments, setMealPayments] = useState<MealPayment[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [orgModal, setOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<MealOrganization | null>(null);
  const [menuModal, setMenuModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MealMenu | null>(null);
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<any | null>(null);
  const [whatsappModal, setWhatsappModal] = useState<string | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [orgRes, partRes] = await Promise.all([
      supabase.from('meal_organizations').select('*').eq('trip_id', trip.id).order('meal_date'),
      supabase.from('participants').select('id, first_name, last_name, class_grade, class_section, phone, status').eq('trip_id', trip.id).neq('status', 'iptal_edildi').order('first_name'),
    ]);
    if (orgRes.data) {
      setOrgs(orgRes.data as MealOrganization[]);
      if (orgRes.data.length > 0 && !selectedOrgId) setSelectedOrgId(orgRes.data[0].id);
    }
    if (partRes.data) setParticipants(partRes.data as any[]);
    setLoading(false);
  };

  const fetchOrgData = async () => {
    if (!selectedOrgId) return;
    const [menuRes, pmRes, payRes] = await Promise.all([
      supabase.from('meal_menus').select('*').eq('meal_organization_id', selectedOrgId).order('name'),
      supabase.from('participant_meals').select('*, meal_menus(name)').eq('meal_organization_id', selectedOrgId),
      supabase.from('meal_payments').select('*').eq('meal_organization_id', selectedOrgId),
    ]);
    if (menuRes.data) setMenus(menuRes.data as MealMenu[]);
    if (pmRes.data) setParticipantMeals(pmRes.data as any[]);
    if (payRes.data) setMealPayments(payRes.data as MealPayment[]);
  };

  useEffect(() => { fetchData(); }, [trip.id]);
  useEffect(() => { fetchOrgData(); }, [selectedOrgId]);

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId);

  // Build meal summary
  const mealSummary = () => {
    const wantsMeal = participantMeals.filter((pm) => pm.wants_meal);
    const noMeal = participants.length - wantsMeal.length;
    const menuCounts: Record<string, number> = {};
    let totalAmount = 0;
    let collected = 0;
    let pending = 0;
    let underpaid = 0;

    wantsMeal.forEach((pm) => {
      const menuName = pm.meal_menus?.name || 'Menüsüz';
      menuCounts[menuName] = (menuCounts[menuName] || 0) + 1;
      const total = pm.menu_price + pm.extra_fee;
      const paid = mealPayments.filter((p) => p.participant_id === pm.participant_id).reduce((s, p) => s + Number(p.amount), 0);
      totalAmount += total;
      collected += paid;
      pending += Math.max(0, total - paid);
      if (paid < total) underpaid++;
    });

    return { wantsMeal, noMeal, menuCounts, totalAmount, collected, pending, underpaid };
  };

  const summary = mealSummary();

  const handleDeleteOrg = async () => {
    if (!deleteOrgId) return;
    const { error } = await supabase.from('meal_organizations').delete().eq('id', deleteOrgId);
    if (error) { toast.error('Silme başarısız: ' + error.message); }
    else { toast.success('Yemek organizasyonu silindi.'); fetchData(); if (selectedOrgId === deleteOrgId) setSelectedOrgId(''); }
    setDeleteOrgId(null);
  };

  const handleDeleteMenu = async () => {
    if (!deleteMenuId) return;
    const { error } = await supabase.from('meal_menus').delete().eq('id', deleteMenuId);
    if (error) { toast.error('Silme başarısız: ' + error.message); }
    else { toast.success('Menü silindi.'); fetchOrgData(); }
    setDeleteMenuId(null);
  };

  const handleSelectMeal = async (participantId: string, wantsMeal: boolean, menuId: string = '') => {
    const existing = participantMeals.find((pm) => pm.participant_id === participantId);
    const menu = menus.find((m) => m.id === menuId);
    const menuPrice = menu ? menu.price : 0;

    if (existing) {
      const { error } = await supabase.from('participant_meals').update({
        wants_meal: wantsMeal,
        meal_menu_id: menuId || null,
        menu_price: menuPrice,
      }).eq('id', existing.id);
      if (error) toast.error('Güncelleme başarısız: ' + error.message);
    } else {
      const { error } = await supabase.from('participant_meals').insert({
        participant_id: participantId,
        trip_id: trip.id,
        meal_organization_id: selectedOrgId,
        meal_menu_id: menuId || null,
        wants_meal: wantsMeal,
        menu_price: menuPrice,
      });
      if (error) toast.error('Ekleme başarısız: ' + error.message);
    }
    fetchOrgData();
  };

  const handleOrderSummaryPdf = async () => {
    if (!selectedOrg) return;
    try {
      const menuRows = Object.entries(summary.menuCounts).map(([name, count]) => ({
        menu: name,
        count: `${count} adet`,
      }));
      await generatePdf({
        title: trip.name,
        reportName: 'Restoran Yemek Sipariş Özeti',
        tripName: trip.name,
        columns: [
          { key: 'menu', header: 'Menü', width: 'auto' },
          { key: 'count', header: 'Adet', width: 80, align: 'right' },
        ],
        rows: menuRows,
        infoLines: [
          { label: 'Restoran', value: selectedOrg.restaurant_name },
          { label: 'Tarih', value: formatDate(selectedOrg.meal_date) },
          { label: 'Saat', value: formatTimeShort(selectedOrg.meal_time) },
          { label: 'Toplam Kişi', value: String(summary.wantsMeal.length) },
          { label: 'Yemek Almayan', value: String(summary.noMeal) },
          { label: 'Toplam Tutar', value: formatCurrency(summary.totalAmount) },
        ],
        fileName: buildFileName([trip.name, 'Yemek_Siparis_Ozeti', formatDate(selectedOrg.meal_date).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) { toast.error('PDF hatası: ' + err.message); }
  };

  const handleSelectionPdf = async () => {
    if (!selectedOrg) return;
    try {
      const rows = participants.map((p, i) => {
        const pm = participantMeals.find((x) => x.participant_id === p.id);
        const menuName = pm?.wants_meal ? (pm.meal_menus?.name || 'Menüsüz') : 'Yemek Almayacak';
        const total = pm?.wants_meal ? (pm.menu_price + pm.extra_fee) : 0;
        const paid = mealPayments.filter((pay) => pay.participant_id === p.id).reduce((s, x) => s + Number(x.amount), 0);
        const status = pm?.wants_meal ? getPaymentStatus(total, paid) : 'ucretsiz' as PaymentStatus;
        return {
          no: i + 1,
          name: `${p.first_name} ${p.last_name}`,
          class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
          menu: menuName,
          total: formatCurrency(total),
          paid: formatCurrency(paid),
          remaining: formatCurrency(Math.max(0, total - paid)),
          status: paymentStatusLabels[status],
        };
      });
      await generatePdf({
        title: trip.name,
        reportName: 'Yemek Seçim Listesi',
        tripName: trip.name,
        columns: [
          { key: 'no', header: '#', width: 25, align: 'center' },
          { key: 'name', header: 'Ad Soyad', width: 'auto' },
          { key: 'class', header: 'Sınıf', width: 50 },
          { key: 'menu', header: 'Menü', width: 'auto' },
          { key: 'total', header: 'Tutar', width: 60, align: 'right' },
          { key: 'paid', header: 'Ödenen', width: 60, align: 'right' },
          { key: 'remaining', header: 'Kalan', width: 60, align: 'right' },
          { key: 'status', header: 'Durum', width: 50, align: 'center' },
        ],
        rows,
        fileName: buildFileName([trip.name, 'Yemek_Secim_Listesi', formatDate(selectedOrg.meal_date).replace(/\./g, '-')]),
      });
      toast.success('PDF indirildi.');
    } catch (err: any) { toast.error('PDF hatası: ' + err.message); }
  };

  const handleExportExcel = () => {
    exportToExcel(
      [
        { key: 'name', header: 'Ad Soyad' },
        { key: 'class', header: 'Sınıf' },
        { key: 'menu', header: 'Menü' },
        { key: 'total', header: 'Tutar' },
        { key: 'paid', header: 'Ödenen' },
        { key: 'remaining', header: 'Kalan' },
        { key: 'status', header: 'Durum' },
      ],
      participants.map((p) => {
        const pm = participantMeals.find((x) => x.participant_id === p.id);
        const menuName = pm?.wants_meal ? (pm.meal_menus?.name || 'Menüsüz') : 'Yok';
        const total = pm?.wants_meal ? (pm.menu_price + pm.extra_fee) : 0;
        const paid = mealPayments.filter((pay) => pay.participant_id === p.id).reduce((s, x) => s + Number(x.amount), 0);
        const status = pm?.wants_meal ? getPaymentStatus(total, paid) : 'ucretsiz' as PaymentStatus;
        return {
          name: `${p.first_name} ${p.last_name}`,
          class: `${p.class_grade || '-'}${p.class_section ? '/' + p.class_section : ''}`,
          menu: menuName,
          total,
          paid,
          remaining: Math.max(0, total - paid),
          status: paymentStatusLabels[status],
        };
      }),
      'Yemek_Secimleri'
    );
    toast.success('Excel indirildi.');
  };

  const handleGenerateWhatsapp = () => {
    if (!selectedOrg) return;
    const lines: string[] = [];
    lines.push(`🍽️ ${trip.name.toUpperCase()} YEMEK BİLGİSİ`);
    lines.push('');
    lines.push(`Merhaba, ${trip.name} gezimiz için yemek organizasyonu bilgileri aşağıdaki gibidir.`);
    lines.push('');
    lines.push(`📍 Yemek Yeri: ${selectedOrg.restaurant_name}`);
    lines.push(`📅 Tarih: ${formatDate(selectedOrg.meal_date)}`);
    lines.push(`🕐 Saat: ${formatTimeShort(selectedOrg.meal_time)}`);
    lines.push(`👥 Toplam Yemek Sayısı: ${summary.wantsMeal.length} kişi`);
    lines.push('');
    lines.push('🍽️ Menü Dağılımı:');
    Object.entries(summary.menuCounts).forEach(([name, count]) => {
      lines.push(`• ${name}: ${count} adet`);
    });
    lines.push(`• Yemek almayan: ${summary.noMeal} kişi`);
    lines.push('');
    lines.push(`💰 Toplam Tutar: ${formatCurrency(summary.totalAmount)}`);
    lines.push('');
    lines.push('Bilgilerinize sunarız.');
    setWhatsappMessage(lines.join('\n'));
    setWhatsappModal(selectedOrg.id);
  };

  if (loading) return <LoadingSpinner label="Yemek organizasyonları yükleniyor..." />;

  return (
    <div className="space-y-4">
      {/* Org selector + add */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Organizasyon:</label>
          <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {orgs.length === 0 && <option value="">Organizasyon yok</option>}
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.restaurant_name} — {o.meal_name}</option>)}
          </select>
        </div>
        <button onClick={() => { setEditingOrg(null); setOrgModal(true); }} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Yemek Organizasyonu Ekle
        </button>
      </div>

      {orgs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState message="Henüz yemek organizasyonu eklenmedi." icon={<UtensilsCrossed className="h-12 w-12" />} />
        </div>
      ) : selectedOrg ? (
        <>
          {/* Org info card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-800">{selectedOrg.restaurant_name}</h3>
                <p className="text-sm text-slate-500">{selectedOrg.meal_name} • {formatDate(selectedOrg.meal_date)} • {formatTimeShort(selectedOrg.meal_time)}</p>
                {selectedOrg.location && <p className="mt-1 text-sm text-slate-500">📍 {selectedOrg.location}</p>}
                {selectedOrg.contact_phone && <p className="text-sm text-slate-500">📞 {selectedOrg.contact_phone}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditingOrg(selectedOrg); setOrgModal(true); }} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleteOrgId(selectedOrg.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {selectedOrg.description && <p className="mt-3 text-sm text-slate-600">{selectedOrg.description}</p>}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryBox label="Yemek Seçen" value={String(summary.wantsMeal.length)} icon={Users} color="blue" />
            <SummaryBox label="Yemek Almayan" value={String(summary.noMeal)} icon={Users} color="slate" />
            <SummaryBox label="Toplam Tutar" value={formatCurrency(summary.totalAmount)} icon={Wallet} color="emerald" />
            <SummaryBox label="Toplanan" value={formatCurrency(summary.collected)} icon={Wallet} color="emerald" />
            <SummaryBox label="Bekleyen" value={formatCurrency(summary.pending)} icon={Wallet} color="rose" />
            <SummaryBox label="Ödemesi Eksik" value={`${summary.underpaid} kişi`} icon={Wallet} color="amber" />
          </div>

          {/* Menu distribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="mb-3 font-semibold text-slate-800">Menü Dağılımı</h4>
            {Object.keys(summary.menuCounts).length === 0 ? (
              <p className="text-sm text-slate-400">Henüz seçim yapılmadı.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(summary.menuCounts).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2">
                    <span className="text-sm font-medium text-slate-700">{name}</span>
                    <span className="text-sm font-bold text-blue-600">{count} kişi</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2">
                  <span className="text-sm font-medium text-slate-600">Yemek almayan</span>
                  <span className="text-sm font-bold text-slate-500">{summary.noMeal} kişi</span>
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp + PDF actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={handleGenerateWhatsapp} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              <MessageCircle className="h-4 w-4" /> WhatsApp Mesajı Oluştur
            </button>
            <ActionButton onClick={handleOrderSummaryPdf} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>Sipariş Özeti PDF</ActionButton>
            <ActionButton onClick={handleSelectionPdf} variant="outline" icon={<FileDown className="h-3.5 w-3.5" />}>Seçim Listesi PDF</ActionButton>
            <ActionButton onClick={handleExportExcel} variant="outline" icon={<Download className="h-3.5 w-3.5" />}>Excel</ActionButton>
          </div>

          {/* Menus section */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-semibold text-slate-800">Menüler</h4>
              <button onClick={() => { setEditingMenu(null); setMenuModal(true); }} className="flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
                <Plus className="h-3.5 w-3.5" /> Menü Ekle
              </button>
            </div>
            {menus.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Henüz menü eklenmedi.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {menus.map((menu) => (
                  <div key={menu.id} className={cn('rounded-lg border p-4', menu.is_active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60')}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-semibold text-slate-800">{menu.name}</h5>
                        {menu.category && <span className="text-xs text-slate-400">{menu.category}</span>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingMenu(menu); setMenuModal(true); }} className="rounded p-1 text-slate-400 hover:text-blue-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteMenuId(menu.id)} className="rounded p-1 text-slate-400 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {menu.content && <p className="mt-2 text-xs leading-relaxed text-slate-500 whitespace-pre-wrap">{menu.content}</p>}
                    <p className="mt-2 font-bold text-blue-600">{formatCurrency(menu.price)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Participant meal selection table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h4 className="font-semibold text-slate-800">Katılımcı Yemek Seçimleri</h4>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-3 py-3 font-semibold text-slate-600">Ad Soyad</th>
                    <th className="px-3 py-3 font-semibold text-slate-600">Sınıf</th>
                    <th className="px-3 py-3 font-semibold text-slate-600">Yemek</th>
                    <th className="px-3 py-3 font-semibold text-slate-600">Menü</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Tutar</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Ödenen</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Kalan</th>
                    <th className="px-3 py-3 font-semibold text-slate-600">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {participants.map((p) => {
                    const pm = participantMeals.find((x) => x.participant_id === p.id);
                    const wantsMeal = pm?.wants_meal || false;
                    const total = wantsMeal ? (pm!.menu_price + pm!.extra_fee) : 0;
                    const paid = mealPayments.filter((pay) => pay.participant_id === p.id).reduce((s, x) => s + Number(x.amount), 0);
                    const remaining = Math.max(0, total - paid);
                    const status = wantsMeal ? getPaymentStatus(total, paid) : 'ucretsiz' as PaymentStatus;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium text-slate-700">{p.first_name} {p.last_name}</td>
                        <td className="px-3 py-2.5 text-slate-500">{p.class_grade || '-'}{p.class_section ? '/' + p.class_section : ''}</td>
                        <td className="px-3 py-2.5">
                          <select
                            value={wantsMeal ? 'yes' : 'no'}
                            onChange={(e) => handleSelectMeal(p.id, e.target.value === 'yes')}
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                          >
                            <option value="no">Almayacak</option>
                            <option value="yes">Alacak</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          {wantsMeal ? (
                            <select
                              value={pm?.meal_menu_id || ''}
                              onChange={(e) => handleSelectMeal(p.id, true, e.target.value)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs"
                            >
                              <option value="">Menü seç</option>
                              {menus.filter((m) => m.is_active).map((m) => <option key={m.id} value={m.id}>{m.name} ({formatCurrency(m.price)})</option>)}
                            </select>
                          ) : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-700">{formatCurrency(total)}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-emerald-600">{formatCurrency(paid)}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-rose-600">{formatCurrency(remaining)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            {wantsMeal && remaining > 0 && (
                              <button onClick={() => setPaymentModal({ participant: p, remaining, pm })} className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
                                Ödeme
                              </button>
                            )}
                            <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', getPaymentStatusColor(status))}>
                              {paymentStatusLabels[status]}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState message="Bir yemek organizasyonu seçin." icon={<UtensilsCrossed className="h-12 w-12" />} />
        </div>
      )}

      {/* Org modal */}
      <Dialog open={orgModal} onOpenChange={setOrgModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader><DialogTitle>{editingOrg ? 'Yemek Organizasyonu Düzenle' : 'Yeni Yemek Organizasyonu'}</DialogTitle></DialogHeader>
          {orgModal && <OrgForm trip={trip} org={editingOrg} onSaved={() => { setOrgModal(false); fetchData(); }} onCancel={() => setOrgModal(false)} />}
        </DialogContent>
      </Dialog>

      {/* Menu modal */}
      <Dialog open={menuModal} onOpenChange={setMenuModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingMenu ? 'Menü Düzenle' : 'Yeni Menü'}</DialogTitle></DialogHeader>
          {menuModal && selectedOrgId && <MenuForm orgId={selectedOrgId} menu={editingMenu} onSaved={() => { setMenuModal(false); fetchOrgData(); }} onCancel={() => setMenuModal(false)} />}
        </DialogContent>
      </Dialog>

      {/* Payment modal */}
      <Dialog open={!!paymentModal} onOpenChange={(open) => !open && setPaymentModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yemek Ödemesi — {paymentModal?.participant.first_name} {paymentModal?.participant.last_name}</DialogTitle></DialogHeader>
          {paymentModal && (
            <MealPaymentForm
              participant={paymentModal.participant}
              orgId={selectedOrgId}
              tripId={trip.id}
              remaining={paymentModal.remaining}
              onSaved={() => { setPaymentModal(null); fetchOrgData(); }}
              onCancel={() => setPaymentModal(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp modal */}
      <Dialog open={!!whatsappModal} onOpenChange={(open) => !open && setWhatsappModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader><DialogTitle>WhatsApp Yemek Mesajı</DialogTitle></DialogHeader>
          {whappMessage(whatsappMessage, setWhatsappMessage)}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteOrgId !== null} onOpenChange={(open) => !open && setDeleteOrgId(null)} title="Yemek Organizasyonunu Sil" description="Bu organizasyon ve tüm menüleri, seçimleri ve ödemeleri silinecek. Bu işlem geri alınamaz." confirmText="Evet, Sil" onConfirm={handleDeleteOrg} />
      <ConfirmDialog open={deleteMenuId !== null} onOpenChange={(open) => !open && setDeleteMenuId(null)} title="Menüyü Sil" description="Bu menüyü silmek istediğinizden emin misiniz?" confirmText="Evet, Sil" onConfirm={handleDeleteMenu} />
    </div>
  );
}

function whappMessage(message: string, setMessage: (s: string) => void) {
  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    toast.success('Mesaj kopyalandı.');
  };
  const handleWhatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };
  return (
    <div className="space-y-3">
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={12} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono" />
      <div className="flex justify-end gap-2">
        <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <Copy className="h-4 w-4" /> Kopyala
        </button>
        <button onClick={handleWhatsapp} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          <MessageCircle className="h-4 w-4" /> WhatsApp'a Git
        </button>
      </div>
    </div>
  );
}

function OrgForm({ trip, org, onSaved, onCancel }: { trip: Trip; org: MealOrganization | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    restaurant_name: '', meal_name: '', meal_date: '', meal_time: '13.00',
    location: '', contact_phone: '', description: '', per_person_service_fee: '0',
    extra_fee: '0', notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org) {
      setForm({
        restaurant_name: org.restaurant_name, meal_name: org.meal_name,
        meal_date: toDateInputValue(org.meal_date), meal_time: org.meal_time || '13.00',
        location: org.location || '', contact_phone: org.contact_phone || '',
        description: org.description || '', per_person_service_fee: String(org.per_person_service_fee),
        extra_fee: String(org.extra_fee), notes: org.notes || '',
      });
    }
  }, [org]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.restaurant_name.trim() || !form.meal_name.trim() || !form.meal_date) {
      toast.error('Restoran adı, yemek adı ve tarih zorunludur.');
      return;
    }
    setSaving(true);
    const payload = {
      trip_id: trip.id,
      restaurant_name: form.restaurant_name.trim(),
      meal_name: form.meal_name.trim(),
      meal_date: form.meal_date,
      meal_time: form.meal_time || null,
      location: form.location || null,
      contact_phone: form.contact_phone || null,
      description: form.description || null,
      per_person_service_fee: parseFloat(form.per_person_service_fee) || 0,
      extra_fee: parseFloat(form.extra_fee) || 0,
      notes: form.notes || null,
    };
    if (org) {
      const { error } = await supabase.from('meal_organizations').update(payload).eq('id', org.id);
      setSaving(false);
      if (error) { toast.error('Güncelleme başarısız: ' + error.message); return; }
      toast.success('Organizasyon güncellendi.');
    } else {
      const { error } = await supabase.from('meal_organizations').insert(payload);
      setSaving(false);
      if (error) { toast.error('Ekleme başarısız: ' + error.message); return; }
      toast.success('Yemek organizasyonu eklendi.');
    }
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Restoran Adı *"><input value={form.restaurant_name} onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })} className={inputClass} /></FormField>
        <FormField label="Yemek Adı *"><input value={form.meal_name} onChange={(e) => setForm({ ...form, meal_name: e.target.value })} className={inputClass} placeholder="Örn. Öğle Yemeği" /></FormField>
        <FormField label="Tarih *"><input type="date" value={form.meal_date} onChange={(e) => setForm({ ...form, meal_date: e.target.value })} className={inputClass} /></FormField>
        <FormField label="Saat"><input value={form.meal_time} onChange={(e) => setForm({ ...form, meal_time: e.target.value })} className={inputClass} placeholder="13.00" /></FormField>
        <FormField label="Konum"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass} /></FormField>
        <FormField label="İletişim"><input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className={inputClass} /></FormField>
        <FormField label="Kişi Başı Servis (TL)"><input type="number" value={form.per_person_service_fee} onChange={(e) => setForm({ ...form, per_person_service_fee: e.target.value })} className={inputClass} /></FormField>
        <FormField label="Ek Ücret (TL)"><input type="number" value={form.extra_fee} onChange={(e) => setForm({ ...form, extra_fee: e.target.value })} className={inputClass} /></FormField>
        <div className="col-span-2"><FormField label="Açıklama"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputClass} /></FormField></div>
        <div className="col-span-2"><FormField label="Notlar"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} /></FormField></div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Kaydediliyor...' : org ? 'Güncelle' : 'Ekle'}</button>
      </div>
    </form>
  );
}

function MenuForm({ orgId, menu, onSaved, onCancel }: { orgId: string; menu: MealMenu | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', content: '', price: '0', category: '', is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (menu) {
      setForm({ name: menu.name, description: menu.description || '', content: menu.content || '', price: String(menu.price), category: menu.category || '', is_active: menu.is_active });
    }
  }, [menu]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Menü adı zorunludur.'); return; }
    setSaving(true);
    const payload = {
      meal_organization_id: orgId,
      name: form.name.trim(),
      description: form.description || null,
      content: form.content || null,
      price: parseFloat(form.price) || 0,
      category: form.category || null,
      is_active: form.is_active,
    };
    if (menu) {
      const { error } = await supabase.from('meal_menus').update(payload).eq('id', menu.id);
      setSaving(false);
      if (error) { toast.error('Güncelleme başarısız: ' + error.message); return; }
      toast.success('Menü güncellendi.');
    } else {
      const { error } = await supabase.from('meal_menus').insert(payload);
      setSaving(false);
      if (error) { toast.error('Ekleme başarısız: ' + error.message); return; }
      toast.success('Menü eklendi.');
    }
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FormField label="Menü Adı *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Örn. Köfte Menü" /></FormField>
      <FormField label="Kategori"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} placeholder="Örn. Ana Yemek" /></FormField>
      <FormField label="Açıklama"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} /></FormField>
      <FormField label="Menü İçeriği"><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} className={inputClass} placeholder="Köfte&#10;Pilav&#10;Salata&#10;Ayran" /></FormField>
      <FormField label="Fiyat (TL)"><input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputClass} /></FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
        Aktif
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Kaydediliyor...' : menu ? 'Güncelle' : 'Ekle'}</button>
      </div>
    </form>
  );
}

function MealPaymentForm({ participant, orgId, tripId, remaining, onSaved, onCancel }: any) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(String(remaining > 0 ? remaining : 0));
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [method, setMethod] = useState<PaymentMethod>('nakit');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Geçerli tutar girin.'); return; }
    setSaving(true);
    const { error } = await supabase.from('meal_payments').insert({
      participant_id: participant.id, trip_id: tripId, meal_organization_id: orgId,
      amount: amt, payment_date: date, payment_method: method,
      description: desc || null, recorded_by: user?.full_name || null,
    });
    setSaving(false);
    if (error) { toast.error('Ödeme eklenemedi: ' + error.message); return; }
    toast.success('Yemek ödemesi eklendi.');
    logActivity(user, 'yemek_odeme_ekle', `Yemek ödemesi: ${participant.first_name} ${participant.last_name}`, 'meal_payment');
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">Kalan:</span><span className="font-bold text-rose-600">{formatCurrency(remaining)}</span></div></div>
      <FormField label="Tutar (TL)"><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /></FormField>
      <FormField label="Tarih"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></FormField>
      <FormField label="Ödeme Yöntemi"><select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputClass}>{Object.entries(paymentMethodLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></FormField>
      <FormField label="Açıklama"><input value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} /></FormField>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Ekleniyor...' : 'Ödeme Ekle'}</button>
      </div>
    </form>
  );
}

function SummaryBox({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    slate: 'border-slate-200 bg-white text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <div className="flex items-center gap-2"><Icon className="h-4 w-4 opacity-60" /><span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span></div>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>{children}</div>;
}
const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
