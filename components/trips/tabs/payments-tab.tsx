'use client';

import { Trip } from '@/lib/types';
import { PaymentsTable } from '@/components/payments/payments-table';

export function TripPaymentsTab({ trip }: { trip: Trip }) {
  return <PaymentsTable trip={trip} fixedTripId={trip.id} />;
}
