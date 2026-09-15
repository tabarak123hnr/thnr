import type { CheckInRecord, PaymentStatus, PaymentTiming } from "./checkIn";

export type InvoiceListStatus = "paid" | "unpaid" | "partial";

/** Room, food, or one combined folio for the stay. */
export type InvoiceType = "room" | "restaurant" | "overall";

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
  /** Unique folio id: `{checkInId}-room`, `{checkInId}-food`, or `{checkInId}-overall` */
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
  discountedNightlyRate: number;
  discountPercent: number;
  discountAmount: number;
  roomChargesBefore: number;
  roomCharges: number;
  foodLines: InvoiceFoodLine[];
  foodTotal: number;
  otherExtras: number;
  extraCharges: number;
  taxLabel: string;
  taxPercent: number;
  taxAmount: number;
  taxAppliesToRoom: boolean;
  taxAppliesToFood: boolean;
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
