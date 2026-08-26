/** Room-service food orders billed to the in-house check-in. */

export type FoodOrderStatus = "pending" | "delivered";

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
  amount: number;
  status: FoodOrderStatus;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  deliveredAt?: string | null;
}

export function calcOrderAmount(items: Pick<FoodOrderItem, "qty" | "unitPrice">[]) {
  return items.reduce((sum, i) => sum + Math.max(0, i.qty) * Math.max(0, i.unitPrice), 0);
}
