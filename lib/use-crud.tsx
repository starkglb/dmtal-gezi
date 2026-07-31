'use client';

import { ReactNode, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { PostgrestError } from '@supabase/supabase-js';

interface UseCrudOptions<T> {
  table: string;
  select?: string;
  filters?: Record<string, string | null>;
  orderBy?: { column: string; ascending?: boolean };
  enabled?: boolean;
  transform?: (data: any[]) => T[];
}

export function useCrud<T extends { id: string }>(options: UseCrudOptions<T>) {
  const { table, select = '*', filters, orderBy, enabled = true, transform } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let query = supabase.from(table).select(select);
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
          query = query.eq(key, value);
        }
      }
    }
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }
    const { data: result, error: err } = await query;
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData(transform ? transform(result as any[]) : (result as unknown as T[]));
    }
    setLoading(false);
  }, [table, select, JSON.stringify(filters), orderBy?.column, orderBy?.ascending, enabled, transform]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const insert = useCallback(
    async (payload: Partial<T>): Promise<{ data: T | null; error: string | null }> => {
      const { data: result, error: err } = await supabase.from(table).insert(payload).select().maybeSingle();
      if (err) return { data: null, error: translateDbError(err) };
      await fetchData();
      return { data: result as T, error: null };
    },
    [table, fetchData]
  );

  const update = useCallback(
    async (id: string, payload: Partial<T>): Promise<{ data: T | null; error: string | null }> => {
      const { data: result, error: err } = await supabase.from(table).update(payload).eq('id', id).select().maybeSingle();
      if (err) return { data: null, error: translateDbError(err) };
      await fetchData();
      return { data: result as T, error: null };
    },
    [table, fetchData]
  );

  const remove = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error: err } = await supabase.from(table).delete().eq('id', id);
      if (err) return { error: translateDbError(err) };
      await fetchData();
      return { error: null };
    },
    [table, fetchData]
  );

  return { data, loading, error, refetch: fetchData, insert, update, remove, setData };
}

export function translateDbError(err: PostgrestError | { message: string }): string {
  const m = err.message.toLowerCase();
  if (m.includes('duplicate') || m.includes('unique')) return 'Bu kayıt zaten mevcut.';
  if (m.includes('foreign key') || m.includes('violates foreign key')) return 'İlişkili kayıt bulunamadı.';
  if (m.includes('not null')) return 'Zorunlu alanlar eksik.';
  if (m.includes('rls') || m.includes('policy')) return 'Bu işlem için yetkiniz yok.';
  if (m.includes('network')) return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
  return err.message;
}

export function LoadingSpinner({ label = 'Yükleniyor...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="rounded-full bg-rose-50 p-3">
        <svg className="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
        </svg>
      </div>
      <p className="text-sm text-rose-600">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Tekrar dene
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="text-slate-300">{icon}</div>}
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
