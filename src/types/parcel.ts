/** Walk-in parcel / takeaway — each physical item is its own printable chit. */

export type ParcelChannel = "parcel" | "delivery";

export type ParcelPaymentStatus = "paid" | "due";

export type ParcelOrderStatus = "open" | "preparing" | "ready" | "handed_over" | "cancelled";

export interface ParcelLine {
  /** Unique per physical unit (same dish clicked twice → two lines). */
  lineId: string;
  menuItemId: string;
  name: string;
  nameUr: string;
  unitPrice: number;
  /** Kitchen / customer slip number for this single item */
  chitNo: string;
}

export interface ParcelOrder {
  id: string;
  token: string;
  channel: ParcelChannel;
  customerName: string;
  customerPhone: string;
  notes: string;
  lines: ParcelLine[];
  /** Sum of every separate line */
  amount: number;
  paymentStatus: ParcelPaymentStatus;
  status: ParcelOrderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  handedOverAt?: string | null;
}
