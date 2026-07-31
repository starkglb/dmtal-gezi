'use client';

import { Trip } from '@/lib/types';
import { ParticipantsTable } from '@/components/participants/participants-table';

export function TripParticipantsTab({ trip }: { trip: Trip }) {
  return <ParticipantsTable trip={trip} fixedTripId={trip.id} />;
}
