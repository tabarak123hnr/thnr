import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type {
  ParcelChannel,
  ParcelLine,
  ParcelOrder,
  ParcelOrderStatus,
  ParcelPaymentStatus,
} from "../types/parcel";

export type { ParcelOrder, ParcelLine };

function nextToken() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `P${n}`;
}

function mapOrder(id: string, data: Record<string, unknown>): ParcelOrder {
  const linesRaw = Array.isArray(data.lines) ? data.lines : [];
  const lines: ParcelLine[] = linesRaw.map((raw, index) => {
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      lineId: String(row.lineId ?? `${id}-${index}`),
      menuItemId: String(row.menuItemId ?? ""),
      name: String(row.name ?? ""),
      nameUr: String(row.nameUr ?? ""),
      unitPrice: Math.max(0, Number(row.unitPrice) || 0),
      chitNo: String(row.chitNo ?? `C${index + 1}`),
    };
  });

  return {
    id,
    token: String(data.token ?? id.slice(0, 6).toUpperCase()),
    channel: (data.channel === "delivery" ? "delivery" : "parcel") as ParcelChannel,
    customerName: String(data.customerName ?? ""),
    customerPhone: String(data.customerPhone ?? ""),
    notes: String(data.notes ?? ""),
    lines,
    amount: Math.max(0, Number(data.amount) || lines.reduce((s, l) => s + l.unitPrice, 0)),
    paymentStatus: data.paymentStatus === "paid" ? "paid" : "due",
    status: (["open", "preparing", "ready", "handed_over", "cancelled"].includes(
      String(data.status),
    )
      ? String(data.status)
      : "open") as ParcelOrderStatus,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    handedOverAt: data.handedOverAt ? String(data.handedOverAt) : null,
  };
}

export function subscribeParcelOrders(
  onData: (rows: ParcelOrder[]) => void,
): Unsubscribe {
  const q = query(collection(db, "parcelOrders"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapOrder(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

export async function createParcelOrder(input: {
  channel?: ParcelChannel;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  lines: Omit<ParcelLine, "chitNo">[];
  paymentStatus?: ParcelPaymentStatus;
}) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to create a parcel order.");
  }
  if (!input.lines.length) {
    throw new Error("Add at least one item.");
  }

  const token = nextToken();
  const lines: ParcelLine[] = input.lines.map((line, index) => ({
    ...line,
    chitNo: `${token}-${String(index + 1).padStart(2, "0")}`,
  }));
  const amount = lines.reduce((s, l) => s + Math.max(0, l.unitPrice), 0);

  const ref = await addDoc(collection(db, "parcelOrders"), {
    token,
    channel: input.channel || "parcel",
    customerName: (input.customerName || "").trim(),
    customerPhone: (input.customerPhone || "").trim(),
    notes: (input.notes || "").trim(),
    lines,
    amount,
    paymentStatus: input.paymentStatus || "paid",
    status: "open",
    handedOverAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });

  return { id: ref.id, token, lines, amount };
}

export async function updateParcelOrderStatus(
  id: string,
  status: ParcelOrderStatus,
) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await updateDoc(doc(db, "parcelOrders", id), {
    status,
    updatedAt: serverTimestamp(),
    ...(status === "handed_over"
      ? { handedOverAt: new Date().toISOString() }
      : {}),
  });
}
