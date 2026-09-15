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

export type BillTaxOptions = {
  taxPercent?: number;
  taxAppliesToRoom?: boolean;
  taxAppliesToFood?: boolean;
};

export type RoomBill = {
  nights: number;
  /** Rack / list rate before discount */
  nightlyRate: number;
  discountedNightlyRate: number;
  discountPercent: number;
  /** Discount money — applied AFTER GST on the room side */
  discountAmount: number;
  roomChargesBefore: number;
  /** Room total after discount (excludes GST) */
  roomCharges: number;
  extraCharges: number;
  subtotal: number;
  taxPercent: number;
  taxAppliesToRoom: boolean;
  taxAppliesToFood: boolean;
  taxAmount: number;
  /** subtotal + tax − discount */
  totalBill: number;
};

/**
 * Bill chain:
 * 1) Room + extras
 * 2) GST on room and/or food bases
 * 3) Room discount % applied after GST (on room + room tax)
 */
export function calcRoomBill(
  nightlyRate: number,
  checkInAt: string | Date,
  checkOutAt: string | Date,
  extraCharges = 0,
  discountPercent = 0,
  tax?: BillTaxOptions,
): RoomBill {
  const rate = Math.max(0, Number(nightlyRate) || 0);
  const nights = stayNights(checkInAt, checkOutAt);
  const roomChargesBefore = roundMoney(rate * nights);
  const extras = Math.max(0, roundMoney(Number(extraCharges) || 0));

  const taxPercent = Math.max(0, Math.min(100, Number(tax?.taxPercent) || 0));
  const taxAppliesToRoom = tax?.taxAppliesToRoom !== false;
  const taxAppliesToFood = tax?.taxAppliesToFood !== false;

  const roomTax = taxAppliesToRoom
    ? roundMoney((roomChargesBefore * taxPercent) / 100)
    : 0;
  const foodTax = taxAppliesToFood ? roundMoney((extras * taxPercent) / 100) : 0;
  const taxAmount = roundMoney(roomTax + foodTax);

  const roomAfterTax = roundMoney(roomChargesBefore + roomTax);
  const pct = clampDiscountPercent(discountPercent);
  const discountAmount = roundMoney((roomAfterTax * pct) / 100);
  const roomNetAfterDiscount = roundMoney(roomAfterTax - discountAmount);
  /** Room line without tax (tax shown separately) */
  const roomCharges = roundMoney(Math.max(0, roomNetAfterDiscount - roomTax));
  const discountedNightlyRate =
    nights > 0 ? roundMoney(roomCharges / nights) : roundMoney(rate * (1 - pct / 100));

  const subtotal = roundMoney(roomChargesBefore + extras);
  const totalBill = roundMoney(subtotal + taxAmount - discountAmount);

  return {
    nights,
    nightlyRate: rate,
    discountedNightlyRate,
    discountPercent: pct,
    discountAmount,
    roomChargesBefore,
    roomCharges,
    extraCharges: extras,
    subtotal,
    taxPercent,
    taxAppliesToRoom,
    taxAppliesToFood,
    taxAmount,
    totalBill,
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
  tax?: BillTaxOptions,
) {
  const actual = calcRoomBill(
    nightlyRate,
    checkInAt,
    actualCheckOutAt,
    extraCharges,
    discountPercent,
    tax,
  );
  const planned = calcRoomBill(
    nightlyRate,
    checkInAt,
    plannedCheckOutAt,
    extraCharges,
    discountPercent,
    tax,
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

export function taxOptionsFromStay(data: {
  taxPercent?: unknown;
  taxAppliesToRoom?: unknown;
  taxAppliesToFood?: unknown;
}): BillTaxOptions {
  return {
    taxPercent: Number(data.taxPercent ?? 0) || 0,
    taxAppliesToRoom: data.taxAppliesToRoom !== false,
    taxAppliesToFood: data.taxAppliesToFood !== false,
  };
}
