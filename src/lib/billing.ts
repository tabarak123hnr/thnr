/** Whole nights between local calendar dates. Same-day stay counts as 1. */
export function stayNights(checkInAt: string | Date, checkOutAt: string | Date): number {
  const a = new Date(checkInAt);
  const b = new Date(checkOutAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  if (b <= a) return 1;
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, days);
}

export function calcRoomBill(
  nightlyRate: number,
  checkInAt: string | Date,
  checkOutAt: string | Date,
  extraCharges = 0,
) {
  const rate = Math.max(0, Number(nightlyRate) || 0);
  const nights = stayNights(checkInAt, checkOutAt);
  const roomCharges = rate * nights;
  const extras = Math.max(0, Number(extraCharges) || 0);
  return {
    nights,
    nightlyRate: rate,
    roomCharges,
    extraCharges: extras,
    totalBill: roomCharges + extras,
  };
}

/** Bill at actual departure vs original plan (early leave charges fewer nights). */
export function calcCheckoutBill(
  nightlyRate: number,
  checkInAt: string | Date,
  plannedCheckOutAt: string | Date,
  actualCheckOutAt: string | Date,
  extraCharges = 0,
) {
  const actual = calcRoomBill(nightlyRate, checkInAt, actualCheckOutAt, extraCharges);
  const planned = calcRoomBill(nightlyRate, checkInAt, plannedCheckOutAt, extraCharges);
  const early =
    new Date(actualCheckOutAt).getTime() < new Date(plannedCheckOutAt).getTime();
  return {
    ...actual,
    plannedNights: planned.nights,
    plannedTotal: planned.totalBill,
    early,
  };
}
