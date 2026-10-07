/** Walk-in parcel / takeaway — one kitchen chit per dish; qty on same dish is one chit. */

export type ParcelChannel = "parcel" | "delivery";

export type ParcelPaymentStatus = "paid" | "due";

export type ParcelOrderStatus = "open" | "preparing" | "ready" | "handed_over" | "cancelled";

export interface ParcelLine {
  lineId: string;
  menuItemId: string;
  name: string;
  nameUr: string;
  unitPrice: number;
  qty: number;
  /** Kitchen / customer slip number for this dish line */
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
  amount: number;
  paymentStatus: ParcelPaymentStatus;
  status: ParcelOrderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  handedOverAt?: string | null;
}

export function parcelLineQty(line: Pick<ParcelLine, "qty">) {
  const q = Number(line.qty);
  return Number.isFinite(q) && q > 0 ? Math.round(q) : 1;
}

export function parcelLineTotal(line: Pick<ParcelLine, "unitPrice" | "qty">) {
  return Math.round(parcelLineQty(line) * Math.max(0, Number(line.unitPrice) || 0) * 100) / 100;
}

export function parcelOrderUnits(lines: ParcelLine[]) {
  return lines.reduce((s, l) => s + parcelLineQty(l), 0);
}
