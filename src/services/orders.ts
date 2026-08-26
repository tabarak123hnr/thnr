import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import {
  calcOrderAmount,
  type FoodOrder,
  type FoodOrderItem,
  type FoodOrderStatus,
} from "../types/order";
import { adjustCheckInExtraCharges } from "./checkIns";

export type { FoodOrder, FoodOrderItem, FoodOrderStatus };

function mapOrder(id: string, data: Record<string, unknown>): FoodOrder {
  const items = Array.isArray(data.items)
    ? (data.items as Record<string, unknown>[]).map((raw) => {
        const qty = Math.max(1, Number(raw.qty) || 1);
        const unitPrice = Math.max(0, Number(raw.unitPrice) || 0);
        return {
          menuItemId: String(raw.menuItemId ?? ""),
          name: String(raw.name ?? ""),
          nameUr: raw.nameUr ? String(raw.nameUr) : undefined,
          unitPrice,
          qty,
          lineTotal: Number(raw.lineTotal) || qty * unitPrice,
        } satisfies FoodOrderItem;
      })
    : [];

  return {
    id,
    token: String(data.token ?? id.slice(0, 6).toUpperCase()),
    roomId: String(data.roomId ?? ""),
    roomNumber: String(data.roomNumber ?? ""),
    checkInId: String(data.checkInId ?? ""),
    guestName: String(data.guestName ?? ""),
    items,
    amount: Number(data.amount) || calcOrderAmount(items),
    status: (data.status as FoodOrderStatus) || "pending",
    notes: String(data.notes ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    deliveredAt: data.deliveredAt ? String(data.deliveredAt) : null,
  };
}

function normalizeItems(
  items: {
    menuItemId: string;
    name: string;
    nameUr?: string;
    unitPrice: number;
    qty: number;
  }[],
): FoodOrderItem[] {
  return items
    .map((i) => {
      const qty = Math.max(1, Math.floor(Number(i.qty) || 0));
      const unitPrice = Math.max(0, Number(i.unitPrice) || 0);
      return {
        menuItemId: String(i.menuItemId || ""),
        name: String(i.name || "").trim(),
        nameUr: String(i.nameUr || "").trim(),
        unitPrice,
        qty,
        lineTotal: qty * unitPrice,
      };
    })
    .filter((i) => i.name && i.qty > 0);
}

function nextToken() {
  return `ORD-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function bumpRoomOpenOrders(roomId: string, delta: number) {
  if (!roomId || !delta) return;
  const ref = doc(db, "rooms", roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const current = Number(snap.data().openOrders ?? 0);
  await updateDoc(ref, {
    openOrders: Math.max(0, current + delta),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeOrders(onData: (rows: FoodOrder[]) => void): Unsubscribe {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapOrder(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

/** One-shot fetch for manual refresh. */
export async function fetchOrders(): Promise<FoodOrder[]> {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapOrder(d.id, d.data() as Record<string, unknown>));
}

export async function createFoodOrder(input: {
  roomId: string;
  roomNumber: string;
  checkInId: string;
  guestName: string;
  items: {
    menuItemId: string;
    name: string;
    nameUr?: string;
    unitPrice: number;
    qty: number;
  }[];
  notes?: string;
}) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to place an order.");
  }

  const items = normalizeItems(input.items);
  if (!items.length) {
    throw new Error("Add at least one menu item.");
  }
  if (!input.checkInId || !input.roomId) {
    throw new Error("Select an in-house room (orders bill to the guest stay).");
  }

  const checkInSnap = await getDoc(doc(db, "checkIns", input.checkInId));
  if (!checkInSnap.exists() || checkInSnap.data().status !== "checked_in") {
    throw new Error("No active check-in for this room. Check the guest in first.");
  }

  const amount = calcOrderAmount(items);
  const token = nextToken();

  const ref = await addDoc(collection(db, "orders"), {
    token,
    roomId: input.roomId,
    roomNumber: input.roomNumber,
    checkInId: input.checkInId,
    guestName: input.guestName.trim(),
    items,
    amount,
    status: "pending" as FoodOrderStatus,
    notes: (input.notes ?? "").trim(),
    deliveredAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });

  await adjustCheckInExtraCharges(input.checkInId, amount);
  await bumpRoomOpenOrders(input.roomId, 1);

  return ref.id;
}

export async function updateFoodOrder(
  id: string,
  input: {
    items: {
      menuItemId: string;
      name: string;
      nameUr?: string;
      unitPrice: number;
      qty: number;
    }[];
    notes?: string;
  },
) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to update an order.");
  }

  const ref = doc(db, "orders", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found.");

  const prev = mapOrder(id, snap.data() as Record<string, unknown>);
  const items = normalizeItems(input.items);
  if (!items.length) throw new Error("Add at least one menu item.");

  const amount = calcOrderAmount(items);
  const delta = amount - prev.amount;

  await updateDoc(ref, {
    items,
    amount,
    notes: (input.notes ?? prev.notes).trim(),
    updatedAt: serverTimestamp(),
  });

  if (delta !== 0 && prev.checkInId) {
    await adjustCheckInExtraCharges(prev.checkInId, delta);
  }
}

export async function markOrderDelivered(id: string) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in.");
  }

  const ref = doc(db, "orders", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found.");

  const prev = mapOrder(id, snap.data() as Record<string, unknown>);
  if (prev.status === "delivered") return;

  await updateDoc(ref, {
    status: "delivered",
    deliveredAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });

  await bumpRoomOpenOrders(prev.roomId, -1);
}

export async function deleteFoodOrder(id: string) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to delete an order.");
  }

  const ref = doc(db, "orders", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found.");

  const prev = mapOrder(id, snap.data() as Record<string, unknown>);

  await deleteDoc(ref);

  if (prev.checkInId && prev.amount) {
    await adjustCheckInExtraCharges(prev.checkInId, -prev.amount);
  }
  if (prev.status === "pending") {
    await bumpRoomOpenOrders(prev.roomId, -1);
  }
}
