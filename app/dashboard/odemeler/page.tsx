'use client';

import { CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { PaymentsTable } from '@/components/payments/payments-table';

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Ödemeler" description="Gezi ödemelerini takip edin" icon={CreditCard} />
      <PaymentsTable />
    </div>
  );
}
