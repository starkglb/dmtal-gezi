'use client';

import { useState, useEffect } from 'react';
import { ScrollText, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { logActivity } from '@/lib/activity';
import { TripRule } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RulesPage() {
  const { user, can } = useAuth();
  const [rules, setRules] = useState<TripRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TripRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [ruleText, setRuleText] = useState('');
  const [saving, setSaving] = useState(false);
  const [usageCheck, setUsageCheck] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('trip_rules').select('*').order('sort_order');
    if (data) setRules(data as TripRule[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleText.trim()) { toast.error('Kural metni boş olamaz.'); return; }
    setSaving(true);
    if (editingRule) {
      const { error } = await supabase.from('trip_rules').update({ rule_text: ruleText.trim(), updated_at: new Date().toISOString() }).eq('id', editingRule.id);
      setSaving(false);
      if (error) { toast.error('Güncelleme başarısız: ' + error.message); return; }
      toast.success('Kural güncellendi.');
    } else {
      const maxOrder = rules.length > 0 ? Math.max(...rules.map(r => r.sort_order)) : 0;
      const { error } = await supabase.from('trip_rules').insert({ rule_text: ruleText.trim(), sort_order: maxOrder + 1 });
      setSaving(false);
      if (error) { toast.error('Ekleme başarısız: ' + error.message); return; }
      toast.success('Kural eklendi.');
      logActivity(user, 'kural_ekle', 'Yeni gezi kuralı eklendi', 'trip_rule');
    }
    setModalOpen(false);
    setRuleText('');
    setEditingRule(null);
    fetchData();
  };

  const handleToggleActive = async (rule: TripRule) => {
    const { error } = await supabase.from('trip_rules').update({ is_active: !rule.is_active, updated_at: new Date().toISOString() }).eq('id', rule.id);
    if (error) { toast.error('İşlem başarısız.'); return; }
    fetchData();
  };

  const handleMove = async (rule: TripRule, direction: 'up' | 'down') => {
    const sorted = [...rules].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(r => r.id === rule.id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const swapRule = sorted[swapIdx];
    await supabase.from('trip_rules').update({ sort_order: rule.sort_order }).eq('id', swapRule.id);
    await supabase.from('trip_rules').update({ sort_order: swapRule.sort_order }).eq('id', rule.id);
    fetchData();
  };

  const handleDeleteCheck = async (id: string) => {
    const { count } = await supabase
      .from('blacklist_violations')
      .select('*', { count: 'exact', head: true })
      .eq('trip_rule_id', id);
    if (count && count > 0) {
      setUsageCheck(`Bu kural ${count} kara liste kaydında kullanılmıştır. Silinmesi halinde geçmiş kayıtlar bozulmayacak ancak kural referansı kaybolacaktır. Yine de silmek istiyor musunuz?`);
    }
    setDeleteId(id);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('trip_rules').delete().eq('id', deleteId);
    if (error) {
      if (error.message.includes('violates foreign key')) {
        toast.error('Bu kural kara liste kayıtlarında kullanıldığı için silinemez. Önce ilgili kara liste kayıtlarını kaldırın.');
      } else {
        toast.error('Silme başarısız: ' + error.message);
      }
    } else {
      toast.success('Kural silindi.');
      fetchData();
    }
    setDeleteId(null);
    setUsageCheck(null);
  };

  if (loading) return <LoadingSpinner label="Kurallar yükleniyor..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gezi Kuralları"
        description="Gezi kurallarını yönetin ve sıralayın"
        icon={ScrollText}
        actions={can('rules') ? (
          <button onClick={() => { setEditingRule(null); setRuleText(''); setModalOpen(true); }} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Yeni Kural
          </button>
        ) : undefined}
      />

      {rules.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState message="Henüz kural eklenmedi." icon={<ScrollText className="h-12 w-12" />} />
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <div key={rule.id} className={cn(
              'flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition',
              rule.is_active ? 'border-slate-200' : 'border-slate-200 opacity-50'
            )}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {idx + 1}
              </span>
              <p className="flex-1 text-sm text-slate-700">{rule.rule_text}</p>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                {rule.is_active ? 'Aktif' : 'Pasif'}
              </span>
              {can('rules') && (
                <div className="flex items-center gap-0.5">
                  <button onClick={() => handleMove(rule, 'up')} disabled={idx === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleMove(rule, 'down')} disabled={idx === rules.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleToggleActive(rule)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title={rule.is_active ? 'Pasif yap' : 'Aktif yap'}>
                    {rule.is_active ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { setEditingRule(rule); setRuleText(rule.rule_text); setModalOpen(true); }} className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDeleteCheck(rule.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit/Add modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold text-slate-800">{editingRule ? 'Kural Düzenle' : 'Yeni Kural'}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <textarea value={ruleText} onChange={(e) => setRuleText(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Kural metnini yazın..." autoFocus />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setModalOpen(false); setRuleText(''); setEditingRule(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) { setDeleteId(null); setUsageCheck(null); } }}
        title="Kuralı Sil"
        description={usageCheck || 'Bu kuralı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.'}
        confirmText="Evet, Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}
