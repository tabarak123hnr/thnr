import type { CheckInRecord, PaymentStatus, PaymentTiming } from "./checkIn";

export type InvoiceListStatus = "paid" | "unpaid" | "partial";

/** Separate documents — never combined on one folio. */
export type InvoiceType = "room" | "restaurant";

export interface InvoiceFoodLine {
  orderToken: string;
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
  /** Delivery status of the parent order */
  status: string;
  /** Order payment: paid at counter or due on stay */
  paymentStatus: "paid" | "due";
}

export interface GuestInvoice {
  /** Unique folio id: `{checkInId}-room` or `{checkInId}-food` */
  id: string;
  /** Parent stay id */
  checkInId: string;
  number: string;
  issuedAt: string;
  guestName: string;
  phone: string;
  email: string;
  cnic: string;
  nationality: string;
  roomNumber: string;
  checkInAt: string;
  checkOutAt: string;
  nights: number;
  nightlyRate: number;
  roomCharges: number;
  foodLines: InvoiceFoodLine[];
  foodTotal: number;
  otherExtras: number;
  extraCharges: number;
  totalBill: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  paymentTiming: PaymentTiming;
  stayStatus: CheckInRecord["status"];
  type: InvoiceType;
  notes: string;
  adults: number;
  children: number;
}

export function invoiceListStatus(inv: GuestInvoice): InvoiceListStatus {
  if (inv.balanceDue <= 0 || inv.paymentStatus === "paid") return "paid";
  if (inv.amountPaid > 0) return "partial";
  return "unpaid";
}
