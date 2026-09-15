/** Room-service food orders billed to the in-house check-in. */

export type FoodOrderStatus = "pending" | "delivered";

/** Whether the guest settled this food ticket at the counter / delivery. */
export type FoodOrderPaymentStatus = "paid" | "due";

export interface FoodOrderItem {
  menuItemId: string;
  name: string;
  nameUr?: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface FoodOrder {
  id: string;
  token: string;
  roomId: string;
  roomNumber: string;
  checkInId: string;
  guestName: string;
  items: FoodOrderItem[];
  /** Food subtotal (before GST) */
  amount: number;
  taxPercent?: number;
  taxAmount?: number;
  status: FoodOrderStatus;
  /** Cash collected for this ticket, or still owed on the stay */
  paymentStatus: FoodOrderPaymentStatus;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  deliveredAt?: string | null;
}

export function calcOrderAmount(items: Pick<FoodOrderItem, "qty" | "unitPrice">[]) {
  return items.reduce((sum, i) => sum + Math.max(0, i.qty) * Math.max(0, i.unitPrice), 0);
}

/** GST stored on the ticket (preferred) or derived from taxPercent. */
export function orderTaxAmount(
  order: Pick<FoodOrder, "amount" | "taxPercent" | "taxAmount">,
) {
  const stored = Number(order.taxAmount) || 0;
  if (stored > 0) return Math.round(stored * 100) / 100;
  const pct = Math.max(0, Math.min(100, Number(order.taxPercent) || 0));
  if (pct <= 0) return 0;
  return Math.round(((Number(order.amount) || 0) * pct) / 100 * 100) / 100;
}

/** Food subtotal + GST for this ticket. */
export function orderTicketTotal(
  order: Pick<FoodOrder, "amount" | "taxPercent" | "taxAmount">,
) {
  return Math.round(((Number(order.amount) || 0) + orderTaxAmount(order)) * 100) / 100;
}
