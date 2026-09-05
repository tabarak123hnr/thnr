import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type {
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseRecord,
} from "../types/expense";
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS } from "../types/expense";

export type { ExpenseRecord, ExpenseCategory, ExpensePaymentMethod };

function asCategory(value: unknown): ExpenseCategory {
  const s = String(value ?? "");
  return (EXPENSE_CATEGORIES as readonly string[]).includes(s)
    ? (s as ExpenseCategory)
    : "miscellaneous";
}

function asPaymentMethod(value: unknown): ExpensePaymentMethod {
  const s = String(value ?? "");
  return (EXPENSE_PAYMENT_METHODS as readonly string[]).includes(s)
    ? (s as ExpensePaymentMethod)
    : "cash";
}

function mapExpense(id: string, data: Record<string, unknown>): ExpenseRecord {
  return {
    id,
    title: String(data.title ?? ""),
    category: asCategory(data.category),
    amount: Math.max(0, Number(data.amount) || 0),
    date: String(data.date ?? "").slice(0, 10),
    paymentMethod: asPaymentMethod(data.paymentMethod),
    vendor: String(data.vendor ?? ""),
    notes: String(data.notes ?? ""),
    recordedBy: String(data.recordedBy ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

export function subscribeExpenses(
  onData: (rows: ExpenseRecord[]) => void,
): Unsubscribe {
  const q = query(collection(db, "expenses"), orderBy("date", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapExpense(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

export async function fetchExpenses(): Promise<ExpenseRecord[]> {
  const q = query(collection(db, "expenses"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapExpense(d.id, d.data() as Record<string, unknown>));
}

export type ExpenseInput = {
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  paymentMethod: ExpensePaymentMethod;
  vendor: string;
  notes: string;
  recordedBy: string;
};

export async function createExpense(input: ExpenseInput) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const amount = Math.max(0, Number(input.amount) || 0);
  if (!input.title.trim()) throw new Error("Title is required.");
  if (!(amount > 0)) throw new Error("Amount must be greater than zero.");
  if (!input.date) throw new Error("Date is required.");

  const ref = await addDoc(collection(db, "expenses"), {
    title: input.title.trim(),
    category: input.category,
    amount,
    date: input.date.slice(0, 10),
    paymentMethod: input.paymentMethod,
    vendor: input.vendor.trim(),
    notes: input.notes.trim(),
    recordedBy: input.recordedBy.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });
  return ref.id;
}

export async function updateExpense(id: string, input: ExpenseInput) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const amount = Math.max(0, Number(input.amount) || 0);
  if (!input.title.trim()) throw new Error("Title is required.");
  if (!(amount > 0)) throw new Error("Amount must be greater than zero.");
  if (!input.date) throw new Error("Date is required.");

  await updateDoc(doc(db, "expenses", id), {
    title: input.title.trim(),
    category: input.category,
    amount,
    date: input.date.slice(0, 10),
    paymentMethod: input.paymentMethod,
    vendor: input.vendor.trim(),
    notes: input.notes.trim(),
    recordedBy: input.recordedBy.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteExpense(id: string) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await deleteDoc(doc(db, "expenses", id));
}
