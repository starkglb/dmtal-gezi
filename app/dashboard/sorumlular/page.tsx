'use client';

import { useState, useEffect } from 'react';
import { UserCog, Plus, Trash2, Shield, Mail, Phone, Eye, EyeOff, Key } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LoadingSpinner, EmptyState } from '@/lib/use-crud';
import { SystemUser, UserRole } from '@/lib/types';
import { roleLabels, rolePermissions } from '@/lib/labels';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function StaffPage() {
  const { user: currentUser, isMainAdmin, refreshUser } = useAuth();
  const [staff, setStaff] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [profileModal, setProfileModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('system_users').select('*').order('full_name');
    if (data) setStaff(data as SystemUser[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    // Delete auth user via supabase admin — we can't do this from client, but we can remove the profile
    const { error } = await supabase.from('system_users').delete().eq('id', deleteId);
    if (error) { toast.error('Silme başarısız: ' + error.message); }
    else { toast.success('Sorumlu silindi.'); fetchData(); }
    setDeleteId(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sorumlular"
        description="Sistem yöneticilerini ve yetkilerini yönetin"
        icon={UserCog}
        actions={
          isMainAdmin ? (
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Yeni Sorumlu
            </button>
          ) : undefined
        }
      />

      {/* Current user profile card */}
      {currentUser && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
              {currentUser.full_name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800">{currentUser.full_name}</p>
              <p className="text-sm text-slate-500">{currentUser.email}</p>
              <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{roleLabels[currentUser.role]}</span>
            </div>
            <button onClick={() => setProfileModal(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Profili Düzenle
            </button>
          </div>
        </div>
      )}

      {/* Staff list */}
      {staff.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white"><EmptyState message="Sorumlu yok." icon={<UserCog className="h-12 w-12" />} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">
                    {s.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">{s.full_name}</h4>
                    <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', s.role === 'ana_yonetici' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700')}>
                      {roleLabels[s.role]}
                    </span>
                  </div>
                </div>
                {isMainAdmin && s.id !== currentUser?.id && (
                  <button onClick={() => setDeleteId(s.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-slate-500">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{s.email}</div>
                {s.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{s.phone}</div>}
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-400">Yetkiler:</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(rolePermissions[s.role] || []).map((perm) => (
                    <span key={perm} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{perm}</span>
                  ))}
                </div>
              </div>
              {!s.is_active && <div className="mt-2 rounded bg-rose-50 px-2 py-1 text-xs text-rose-600">Pasif</div>}
            </div>
          ))}
        </div>
      )}

      {/* Add staff modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni Sorumlu Ekle</DialogTitle></DialogHeader>
          {modalOpen && <StaffForm onSaved={() => { setModalOpen(false); fetchData(); }} onCancel={() => setModalOpen(false)} />}
        </DialogContent>
      </Dialog>

      {/* Profile edit modal */}
      <Dialog open={profileModal} onOpenChange={setProfileModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Profil Düzenle</DialogTitle></DialogHeader>
          {profileModal && currentUser && (
            <ProfileForm user={currentUser} onSaved={() => { setProfileModal(false); refreshUser(); fetchData(); }} onCancel={() => setProfileModal(false)} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)} title="Sorumluyu Sil" description="Bu sorumluyu silmek istediğinizden emin misiniz? Sisteme giriş yapamayacak." confirmText="Evet, Sil" onConfirm={handleDelete} />
    </div>
  );
}

function StaffForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'gezi_sorumlusu' as UserRole, phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('Tüm zorunlu alanları doldurun.');
      return;
    }
    if (form.password.length < 6) { toast.error('Şifre en az 6 karakter olmalı.'); return; }
    setSaving(true);
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
    });
    if (authError) { setSaving(false); toast.error('Kullanıcı oluşturulamadı: ' + authError.message); return; }
    if (authData.user) {
      const { error: profileError } = await supabase.from('system_users').insert({
        id: authData.user.id,
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        role: form.role,
        phone: form.phone || null,
        is_active: true,
      });
      setSaving(false);
      if (profileError) { toast.error('Profil oluşturulamadı: ' + profileError.message); return; }
      toast.success('Sorumlu eklendi.');
    }
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Ad Soyad *</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputClass} /></div>
      <div><label className="mb-1 block text-sm font-medium text-slate-700">E-posta *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Şifre *</label>
        <div className="relative">
          <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
      </div>
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Telefon</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="05XX..." /></div>
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Rol</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className={inputClass}>{Object.entries(roleLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Ekleniyor...' : 'Ekle'}</button>
      </div>
    </form>
  );
}

function ProfileForm({ user, onSaved, onCancel }: { user: SystemUser; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ full_name: user.full_name, phone: user.phone || '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('Ad soyad zorunlu.'); return; }
    setSaving(true);
    const { error } = await supabase.from('system_users').update({
      full_name: form.full_name.trim(),
      phone: form.phone || null,
    }).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Güncelleme başarısız: ' + error.message); return; }
    toast.success('Profil güncellendi.');
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Ad Soyad</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputClass} /></div>
      <div><label className="mb-1 block text-sm font-medium text-slate-700">Telefon</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} /></div>
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">E-posta adresiniz değiştirilemez. Şifre değişikliği için giriş yapılıktan sonra ayarlardan yapabilirsiniz.</div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">İptal</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Kaydediliyor...' : 'Güncelle'}</button>
      </div>
    </form>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
