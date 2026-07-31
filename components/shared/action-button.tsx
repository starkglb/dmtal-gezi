'use client';

import { useState, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionButtonProps {
  onClick: () => void | Promise<void>;
  children: ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  icon?: ReactNode;
  loadingText?: string;
  disabled?: boolean;
}

export function ActionButton({
  onClick,
  children,
  variant = 'outline',
  size = 'sm',
  className,
  icon,
  loadingText = 'İşleniyor...',
  disabled,
}: ActionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' && 'h-8 px-3',
        size === 'default' && 'h-9 px-4',
        size === 'icon' && 'h-8 w-8',
        variant === 'default' && 'bg-blue-600 text-white hover:bg-blue-700',
        variant === 'outline' && 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        variant === 'secondary' && 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        className
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {size !== 'icon' && (loading ? loadingText : children)}
    </button>
  );
}
