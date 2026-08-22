export type CheckInStatus = "checked_in" | "checked_out";

/** When the guest settles the room bill */
export type PaymentTiming = "paid_at_checkin" | "due_on_checkout";

/** Settled result — due/paid finalize on checkout (or immediately if paid at check-in) */
export type PaymentStatus = "paid" | "due" | "pending";

export interface CheckInCompanion {
  name: string;
  cnic?: string;
  phone?: string;
  relation?: string;
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
  cnicImageUrl: string | null;
  notes: string;
  status: CheckInStatus;
  paymentTiming: PaymentTiming;
  paymentStatus: PaymentStatus;
  /** Snapshot of room rate at check-in / last update */
  nightlyRate: number;
  nights: number;
  roomCharges: number;
  extraCharges: number;
  totalBill: number;
  checkedOutAt?: string | null;
  checkoutMode?: "manual" | "automatic" | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}
