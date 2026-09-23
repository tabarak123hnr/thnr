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
import { roundMoney } from "../lib/billing";
import type { PaymentMethod } from "../types/checkIn";
import type { MiscBill, MiscBillItem, MiscPaymentStatus } from "../types/miscBill";

function stampFrom(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--------";
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function shortToken() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generateMiscBillNumber(roomNumber: string, dateIso: string) {
  const roomClean = (roomNumber || "RM").replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "RM";
  return `INV-MS-${roomClean}-${stampFrom(dateIso)}-${shortToken()}`;
}

function mapMiscBill(id: string, data: Record<string, unknown>): MiscBill {
  const items: MiscBillItem[] = Array.isArray(data.items)
    ? (data.items as Record<string, unknown>[]).map((it) => {
        const qty = Math.max(1, Number(it.qty) || 1);
        const unitPrice = Math.max(0, Number(it.unitPrice) || 0);
        return {
          id: it.id ? String(it.id) : undefined,
          name: String(it.name ?? "").trim(),
          qty,
          unitPrice,
          amount: Number(it.amount) || roundMoney(qty * unitPrice),
        };
      })
    : [];

  const subtotal =
    Number(data.subtotal) || roundMoney(items.reduce((s, it) => s + it.amount, 0));
  const totalAmount = subtotal; // NEVER add GST on miscellaneous
  const paymentStatus = (data.paymentStatus === "paid" ? "paid" : "due") as MiscPaymentStatus;
  const amountPaid =
    paymentStatus === "paid" ? totalAmount : Math.max(0, Number(data.amountPaid) || 0);
  const balanceDue = Math.max(0, roundMoney(totalAmount - amountPaid));

  let createdAt = new Date().toISOString();
  if (typeof data.createdAt === "string") {
    createdAt = data.createdAt;
  } else if (data.createdAt && typeof (data.createdAt as { toDate?: () => Date }).toDate === "function") {
    createdAt = (data.createdAt as { toDate: () => Date }).toDate().toISOString();
  }

  return {
    id,
    billNumber: String(data.billNumber ?? `INV-MS-RM-${id.slice(0, 4)}`),
    checkInId: String(data.checkInId ?? ""),
    roomId: data.roomId ? String(data.roomId) : undefined,
    roomNumber: String(data.roomNumber ?? ""),
    guestName: String(data.guestName ?? ""),
    items,
    subtotal,
    taxAmount: 0,
    taxPercent: 0,
    totalAmount,
    amountPaid,
    balanceDue,
    paymentStatus,
    paymentMethod: (data.paymentMethod as PaymentMethod) || null,
    clearedAt: data.clearedAt ? String(data.clearedAt) : null,
    notes: data.notes ? String(data.notes) : "",
    createdAt,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

export async function fetchMiscBills(): Promise<MiscBill[]> {
  const q = query(collection(db, "miscBills"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapMiscBill(d.id, d.data() as Record<string, unknown>));
}

export function subscribeMiscBills(onUpdate: (bills: MiscBill[]) => void): Unsubscribe {
  const q = query(collection(db, "miscBills"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => mapMiscBill(d.id, d.data() as Record<string, unknown>));
      onUpdate(list);
    },
    (err) => {
      console.warn("subscribeMiscBills error, retrying without order:", err);
      // Fallback in case index is missing
      const fallbackQuery = collection(db, "miscBills");
      return onSnapshot(fallbackQuery, (snap) => {
        const list = snap.docs.map((d) => mapMiscBill(d.id, d.data() as Record<string, unknown>));
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(list);
      });
    },
  );
}

export interface CreateMiscBillInput {
  checkInId: string;
  roomId?: string;
  roomNumber: string;
  guestName: string;
  items: {
    name: string;
    qty: number;
    unitPrice: number;
  }[];
  paymentStatus?: MiscPaymentStatus;
  paymentMethod?: PaymentMethod | null;
  notes?: string;
}

export async function createMiscBill(input: CreateMiscBillInput): Promise<MiscBill> {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to create a miscellaneous bill.");
  }

  const validItems: MiscBillItem[] = input.items
    .map((it) => {
      const name = (it.name || "").trim();
      const qty = Math.max(1, Number(it.qty) || 1);
      const unitPrice = Math.max(0, Number(it.unitPrice) || 0);
      return {
        name,
        qty,
        unitPrice,
        amount: roundMoney(qty * unitPrice),
      };
    })
    .filter((it) => it.name.length > 0 && it.amount > 0);

  if (!validItems.length) {
    throw new Error("Add at least one item with a valid name and price.");
  }

  const subtotal = roundMoney(validItems.reduce((s, it) => s + it.amount, 0));
  const totalAmount = subtotal; // Strictly NO GST
  const paymentStatus: MiscPaymentStatus = input.paymentStatus ?? "due";
  const amountPaid = paymentStatus === "paid" ? totalAmount : 0;
  const balanceDue = Math.max(0, roundMoney(totalAmount - amountPaid));
  const nowIso = new Date().toISOString();
  const billNumber = generateMiscBillNumber(input.roomNumber, nowIso);

  const docData = {
    billNumber,
    checkInId: input.checkInId.trim(),
    roomId: (input.roomId || "").trim(),
    roomNumber: (input.roomNumber || "").trim(),
    guestName: (input.guestName || "").trim(),
    items: validItems,
    subtotal,
    taxAmount: 0,
    taxPercent: 0,
    totalAmount,
    amountPaid,
    balanceDue,
    paymentStatus,
    paymentMethod: paymentStatus === "paid" ? input.paymentMethod || "cash" : null,
    clearedAt: paymentStatus === "paid" ? nowIso : null,
    notes: (input.notes || "").trim(),
    createdAt: nowIso,
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  };

  const ref = await addDoc(collection(db, "miscBills"), docData);
  return mapMiscBill(ref.id, docData);
}

export async function clearMiscBill(
  id: string,
  options: {
    paymentMethod: PaymentMethod;
  },
): Promise<MiscBill> {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to clear a bill.");
  }
  const ref = doc(db, "miscBills", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Miscellaneous bill not found.");
  }

  const data = snap.data();
  const totalAmount = Number(data.totalAmount) || Number(data.subtotal) || 0;
  const nowIso = new Date().toISOString();

  const patch = {
    amountPaid: totalAmount,
    balanceDue: 0,
    paymentStatus: "paid" as MiscPaymentStatus,
    paymentMethod: options.paymentMethod,
    clearedAt: nowIso,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, patch);
  return mapMiscBill(id, { ...data, ...patch });
}

export async function deleteMiscBill(id: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to delete a miscellaneous bill.");
  }
  await deleteDoc(doc(db, "miscBills", id));
}
