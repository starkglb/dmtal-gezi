'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { rolePermissions } from '@/lib/labels';
import { roleLabels } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { navItems } from './nav-items';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = navItems.filter((item) => {
    if (!user) return false;
    const perms = rolePermissions[user.role] || [];
    return perms.includes(item.permission);
  });

  // Close mobile sidebar on route change
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 lg:static lg:translate-x-0',
          collapsed ? 'w-16' : 'w-64',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Bus className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-800">GEZİYÖNET</h1>
              <p className="truncate text-xs text-slate-500">Gezi Yönetim Sistemi</p>
            </div>
          )}
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3">
          <ul className="space-y-0.5 px-2">
            {visibleItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      collapsed && 'justify-center'
                    )}
                  >
                    <item.icon className={cn('h-5 w-5 shrink-0', active && 'text-blue-600')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User info + collapse toggle */}
        <div className="border-t border-slate-200 p-3">
          {!collapsed && user && (
            <div className="mb-2 rounded-lg bg-slate-50 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-700">{user.full_name}</p>
              <p className="truncate text-xs text-slate-500">{roleLabels[user.role]}</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm text-slate-500 transition hover:bg-slate-50 lg:flex"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Daralt</>}
          </button>
        </div>
      </aside>
    </>
  );
}
