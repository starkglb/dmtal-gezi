'use client';

import { Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { ParticipantsTable } from '@/components/participants/participants-table';

export default function ParticipantsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Katılımcılar"
        description="Tüm gezi katılımcılarını yönetin"
        icon={Users}
      />
      <ParticipantsTable />
    </div>
  );
}
