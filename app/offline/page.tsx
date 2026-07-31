'use client';

import { Bus, WifiOff } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white">
        <Bus className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800">GEZİYÖNET</h1>
      <div className="mt-4 flex items-center gap-2 text-slate-500">
        <WifiOff className="h-5 w-5" />
        <span className="text-lg">İnternet bağlantısı yok</span>
      </div>
      <p className="mt-2 max-w-sm text-sm text-slate-400">
        Şu anda çevrimdışısınız. İnternet bağlantınız geri geldiğinde uygulama otomatik olarak yeniden yüklenecektir.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Tekrar Dene
      </Link>
    </div>
  );
}
