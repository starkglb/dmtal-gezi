'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  variant?: 'default' | 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' | 'indigo';
  subtitle?: string;
}

const variantStyles: Record<NonNullable<StatCardProps['variant']>, { bg: string; text: string; ring: string }> = {
  default: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-100' },
};

export function StatCard({ label, value, icon: Icon, variant = 'default', subtitle }: StatCardProps) {
  const styles = variantStyles[variant];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 text-xl font-semibold text-slate-800 sm:text-2xl">{value}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-4', styles.bg, styles.text, styles.ring)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
