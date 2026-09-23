export type CheckInStatus = "checked_in" | "checked_out" | "cancelled";

/**
 * How the guest plans to settle:
 * - paid_at_checkin: full bill paid now
 * - due_on_checkout: nothing paid now, full bill at checkout
 * - partial: some cash now, remainder due at checkout
 */
export type PaymentTiming = "paid_at_checkin" | "due_on_checkout" | "partial";

/** How the guest paid (check-in collection or checkout settlement). */
export type PaymentMethod = "cash" | "card" | "online";

export interface CardPaymentDetails {
  holderName?: string;
  cardNumber?: string;
}

export interface OnlinePaymentDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
}

/** Settled result across the stay */
export type PaymentStatus = "paid" | "due" | "pending" | "partial";

export interface CheckInCompanion {
  name: string;
  cnic?: string;
  phone?: string;
  relation?: string;
  photoUrl?: string;
  cnicFrontImageUrl?: string;
  cnicBackImageUrl?: string;
}

export interface CheckInRecord {
  id: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  phone: string;
  cnic: string;
  nationality: string;
  purpose: string;
  adults: number;
  children: number;
  companions: CheckInCompanion[];
  checkInAt: string;
  checkOutAt: string;
  /** Original planned departure — kept when guest leaves early */
  plannedCheckOutAt: string;
  guestPhotoUrl: string | null;
  cnicImageUrl: string | null;
  /** CNIC front / back images (cnicImageUrl kept as front for older records) */
  cnicFrontImageUrl: string | null;
  cnicBackImageUrl: string | null;
  email: string;
  notes: string;
  /** Staff member who performed check-in */
  checkedInBy: string;
  vehicleColor: string;
  vehicleNumber: string;
  /** Staff member who performed check-out */
  checkedOutBy: string;
  status: CheckInStatus;
  paymentTiming: PaymentTiming;
  paymentStatus: PaymentStatus;
  /** Cash collected so far (at check-in and/or checkout) */
  amountPaid: number;
  /** Remaining balance (totalBill - amountPaid) */
  balanceDue: number;
  /** Method used for money collected at check-in (full or partial). */
  checkInPaymentMethod: PaymentMethod | null;
  /** Method used when the remaining balance was collected at checkout. */
  checkoutPaymentMethod: PaymentMethod | null;
  /** Method used when the room folio itself was cleared from Invoices. */
  roomBillPaymentMethod: PaymentMethod | null;
  roomBillCardDetails: CardPaymentDetails | null;
  roomBillOnlineDetails: OnlinePaymentDetails | null;
  roomBillClearedAt: string | null;
  /** Snapshot of room rate at check-in / last update (before discount) */
  nightlyRate: number;
  /** 0–100 off room (after GST) */
  discountPercent: number;
  discountAmount: number;
  discountedNightlyRate: number;
  nights: number;
  roomCharges: number;
  extraCharges: number;
  subtotal: number;
  taxRateId: string | null;
  taxLabel: string;
  taxPercent: number;
  taxAppliesToRoom: boolean;
  taxAppliesToFood: boolean;
  taxAmount: number;
  /** GST % applied once on the guest’s total food bill (set when food bill is cleared). */
  foodTaxPercent: number;
  foodTaxLabel: string;
  foodTaxRateId: string | null;
  foodBillPaymentMethod: PaymentMethod | null;
  foodServiceCharge: number;
  foodBillClearedAt: string | null;
  totalBill: number;
  checkedOutAt?: string | null;
  checkoutMode?: "manual" | "automatic" | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}

/** Derive paid / balance / status from plan + cash collected. */
export function resolvePaymentSplit(
  totalBill: number,
  timing: PaymentTiming,
  amountPaidInput?: number,
): { amountPaid: number; balanceDue: number; paymentStatus: PaymentStatus; paymentTiming: PaymentTiming } {
  const total = Math.max(0, Number(totalBill) || 0);
  let timingOut = timing;
  let amountPaid = 0;

  if (timing === "paid_at_checkin") {
    amountPaid = total;
  } else if (timing === "due_on_checkout") {
    amountPaid = 0;
  } else {
    amountPaid = Math.min(total, Math.max(0, Number(amountPaidInput) || 0));
    // Exact full payment via partial UI → treat as fully paid at check-in
    if (total > 0 && amountPaid >= total) {
      amountPaid = total;
      timingOut = "paid_at_checkin";
    } else if (amountPaid <= 0) {
      amountPaid = 0;
      timingOut = "due_on_checkout";
    }
  }

  const balanceDue = Math.max(0, Math.round((total - amountPaid) * 100) / 100);
  amountPaid = Math.round(amountPaid * 100) / 100;

  let paymentStatus: PaymentStatus;
  if (balanceDue <= 0) paymentStatus = "paid";
  else if (amountPaid > 0) paymentStatus = "partial";
  else paymentStatus = timingOut === "due_on_checkout" ? "pending" : "pending";

  return {
    amountPaid,
    balanceDue,
    paymentStatus,
    paymentTiming: balanceDue <= 0 ? "paid_at_checkin" : amountPaid > 0 ? "partial" : "due_on_checkout",
  };
}
