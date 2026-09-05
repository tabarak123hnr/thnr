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
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import {
  calcOrderAmount,
  type FoodOrder,
  type FoodOrderItem,
  type FoodOrderPaymentStatus,
  type FoodOrderStatus,
} from "../types/order";
import { adjustCheckInExtraCharges } from "./checkIns";

export type { FoodOrder, FoodOrderItem, FoodOrderPaymentStatus, FoodOrderStatus };

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

  const paymentRaw = String(data.paymentStatus ?? "due");
  const paymentStatus: FoodOrderPaymentStatus =
    paymentRaw === "paid" ? "paid" : "due";

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
    paymentStatus,
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
  /** Default due — add to guest bill. Paid = cash collected now. */
  paymentStatus?: FoodOrderPaymentStatus;
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
  const paymentStatus: FoodOrderPaymentStatus =
    input.paymentStatus === "paid" ? "paid" : "due";

  const ref = await addDoc(collection(db, "orders"), {
    token,
    roomId: input.roomId,
    roomNumber: input.roomNumber,
    checkInId: input.checkInId,
    guestName: input.guestName.trim(),
    items,
    amount,
    status: "pending" as FoodOrderStatus,
    paymentStatus,
    notes: (input.notes ?? "").trim(),
    deliveredAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });

  await adjustCheckInExtraCharges(input.checkInId, amount, {
    paidDelta: paymentStatus === "paid" ? amount : 0,
  });
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
    await adjustCheckInExtraCharges(prev.checkInId, delta, {
      paidDelta: prev.paymentStatus === "paid" ? delta : 0,
    });
  }
}

export async function markOrderPayment(
  id: string,
  paymentStatus: FoodOrderPaymentStatus,
) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in.");
  }

  const ref = doc(db, "orders", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found.");

  const prev = mapOrder(id, snap.data() as Record<string, unknown>);
  if (prev.paymentStatus === paymentStatus) return;

  await updateDoc(ref, {
    paymentStatus,
    updatedAt: serverTimestamp(),
  });

  if (!prev.checkInId || !prev.amount) return;

  // due → paid: guest paid this ticket now
  // paid → due: reverse the cash against the stay
  const paidDelta =
    paymentStatus === "paid" && prev.paymentStatus === "due"
      ? prev.amount
      : paymentStatus === "due" && prev.paymentStatus === "paid"
        ? -prev.amount
        : 0;

  if (paidDelta) {
    await adjustCheckInExtraCharges(prev.checkInId, 0, { paidDelta });
  }
}

/**
 * At checkout the stay bill is settled in full — flip any due kitchen tickets
 * to paid without touching stay totals (already set to paid / balance 0).
 */
export async function markStayFoodOrdersPaid(checkInId: string) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  if (!checkInId) return 0;

  const q = query(collection(db, "orders"), where("checkInId", "==", checkInId));
  const snap = await getDocs(q);
  let updated = 0;
  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() as Record<string, unknown>;
      const status = String(data.paymentStatus ?? "due");
      if (status === "paid") return;
      await updateDoc(doc(db, "orders", d.id), {
        paymentStatus: "paid" satisfies FoodOrderPaymentStatus,
        updatedAt: serverTimestamp(),
      });
      updated += 1;
    }),
  );
  return updated;
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
    await adjustCheckInExtraCharges(prev.checkInId, -prev.amount, {
      paidDelta: prev.paymentStatus === "paid" ? -prev.amount : 0,
    });
  }
  if (prev.status === "pending") {
    await bumpRoomOpenOrders(prev.roomId, -1);
  }
}
