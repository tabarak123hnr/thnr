import type { PaymentMethod } from "./checkIn";

export type MiscPaymentStatus = "paid" | "due";

export interface MiscBillItem {
  id?: string;
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface MiscBill {
  id: string;
  billNumber: string;
  checkInId: string;
  roomId?: string;
  roomNumber: string;
  guestName: string;
  items: MiscBillItem[];
  subtotal: number;
  taxAmount: number; // Always 0 (No GST)
  taxPercent: number; // Always 0 (No GST)
  totalAmount: number; // Equals subtotal
  amountPaid: number;
  balanceDue: number;
  paymentStatus: MiscPaymentStatus;
  paymentMethod: PaymentMethod | null;
  clearedAt?: string | null;
  notes?: string;
  createdAt: string; // ISO string
  updatedAt?: string;
  createdBy?: string;
}
