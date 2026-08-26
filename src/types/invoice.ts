import type { CheckInRecord, PaymentStatus, PaymentTiming } from "./checkIn";

export type InvoiceListStatus = "paid" | "unpaid" | "partial";

export type InvoiceType = "room" | "restaurant" | "combined";

export interface InvoiceFoodLine {
  orderToken: string;
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
  status: string;
}

export interface GuestInvoice {
  /** Same as check-in id */
  id: string;
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
