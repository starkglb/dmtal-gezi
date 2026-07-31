import {
  Participant,
  TripPayment,
  MealPayment,
  ParticipantMeal,
  PaymentStatus,
} from './types';

export function calculateTripPayment(
  participant: Pick<Participant, 'trip_id'> & { trips?: { price: number } },
  tripPrice: number,
  payments: TripPayment[]
) {
  const totalDebt = tripPrice - (participant as Participant).trip_discount + (participant as Participant).trip_extra_fee;
  const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = totalDebt - paid;
  return { totalDebt, paid, remaining };
}

export function getPaymentStatus(totalDebt: number, paid: number): PaymentStatus {
  if (totalDebt <= 0) return 'ucretsiz';
  if (paid <= 0) return 'odenmedi';
  if (paid < totalDebt) return 'kismi_odeme';
  if (paid === totalDebt) return 'odendi';
  return 'fazla_odeme';
}

export function calculateMealPayment(
  participantMeal: ParticipantMeal | null,
  payments: MealPayment[]
) {
  if (!participantMeal || !participantMeal.wants_meal) {
    return { totalDebt: 0, paid: 0, remaining: 0, status: 'ucretsiz' as PaymentStatus };
  }
  const totalDebt = participantMeal.menu_price + participantMeal.extra_fee;
  const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = totalDebt - paid;
  const status = getPaymentStatus(totalDebt, paid);
  return { totalDebt, paid, remaining, status };
}

export function getPaymentStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'odendi':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'kismi_odeme':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'odenmedi':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'fazla_odeme':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'ucretsiz':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export function getPaymentStatusDot(status: PaymentStatus): string {
  switch (status) {
    case 'odendi':
      return 'bg-emerald-500';
    case 'kismi_odeme':
      return 'bg-amber-500';
    case 'odenmedi':
      return 'bg-rose-500';
    case 'fazla_odeme':
      return 'bg-blue-500';
    case 'ucretsiz':
      return 'bg-slate-400';
    default:
      return 'bg-slate-400';
  }
}
