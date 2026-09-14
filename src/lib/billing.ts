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

export function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** 0–100. Invalid values become 0. */
export function clampDiscountPercent(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, roundMoney(n));
}

export type RoomBill = {
  nights: number;
  /** Rack / list rate before discount */
  nightlyRate: number;
  discountedNightlyRate: number;
  discountPercent: number;
  discountAmount: number;
  roomChargesBefore: number;
  /** Room total after discount */
  roomCharges: number;
  extraCharges: number;
  totalBill: number;
};

export function calcRoomBill(
  nightlyRate: number,
  checkInAt: string | Date,
  checkOutAt: string | Date,
  extraCharges = 0,
  discountPercent = 0,
): RoomBill {
  const rate = Math.max(0, Number(nightlyRate) || 0);
  const nights = stayNights(checkInAt, checkOutAt);
  const pct = clampDiscountPercent(discountPercent);
  const roomChargesBefore = roundMoney(rate * nights);
  const discountAmount = roundMoney(roomChargesBefore * (pct / 100));
  const roomCharges = roundMoney(roomChargesBefore - discountAmount);
  const discountedNightlyRate =
    nights > 0 ? roundMoney(roomCharges / nights) : roundMoney(rate * (1 - pct / 100));
  const extras = Math.max(0, Number(extraCharges) || 0);
  return {
    nights,
    nightlyRate: rate,
    discountedNightlyRate,
    discountPercent: pct,
    discountAmount,
    roomChargesBefore,
    roomCharges,
    extraCharges: extras,
    totalBill: roundMoney(roomCharges + extras),
  };
}

/** Bill at actual departure vs original plan (early leave charges fewer nights). */
export function calcCheckoutBill(
  nightlyRate: number,
  checkInAt: string | Date,
  plannedCheckOutAt: string | Date,
  actualCheckOutAt: string | Date,
  extraCharges = 0,
  discountPercent = 0,
) {
  const actual = calcRoomBill(
    nightlyRate,
    checkInAt,
    actualCheckOutAt,
    extraCharges,
    discountPercent,
  );
  const planned = calcRoomBill(
    nightlyRate,
    checkInAt,
    plannedCheckOutAt,
    extraCharges,
    discountPercent,
  );
  const early =
    new Date(actualCheckOutAt).getTime() < new Date(plannedCheckOutAt).getTime();
  return {
    ...actual,
    plannedNights: planned.nights,
    plannedTotal: planned.totalBill,
    early,
  };
}
