import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type { TaxRate } from "../types/tax";

export type { TaxRate };

function mapTax(id: string, data: Record<string, unknown>): TaxRate {
  return {
    id,
    name: String(data.name ?? "").trim() || "Tax",
    percent: Math.max(0, Math.min(100, Number(data.percent) || 0)),
    appliesToRoom: data.appliesToRoom !== false,
    appliesToFood: data.appliesToFood !== false,
    active: data.active !== false,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function subscribeTaxRates(onData: (rows: TaxRate[]) => void): Unsubscribe {
  const q = query(collection(db, "taxRates"), orderBy("name"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapTax(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

export async function createTaxRate(input: {
  name: string;
  percent: number;
  appliesToRoom?: boolean;
  appliesToFood?: boolean;
}) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const percent = Math.max(0, Math.min(100, Number(input.percent) || 0));
  if (!input.name.trim()) throw new Error("Enter a tax name.");
  if (percent <= 0) throw new Error("Enter a tax percentage greater than 0.");

  const ref = await addDoc(collection(db, "taxRates"), {
    name: input.name.trim(),
    percent,
    appliesToRoom: input.appliesToRoom !== false,
    appliesToFood: input.appliesToFood !== false,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });
  return ref.id;
}

export async function deleteTaxRate(id: string) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await deleteDoc(doc(db, "taxRates", id));
}

export async function updateTaxRate(
  id: string,
  input: Partial<Pick<TaxRate, "name" | "percent" | "appliesToRoom" | "appliesToFood" | "active">>,
) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.name != null) patch.name = input.name.trim();
  if (input.percent != null) {
    patch.percent = Math.max(0, Math.min(100, Number(input.percent) || 0));
  }
  if (input.appliesToRoom != null) patch.appliesToRoom = input.appliesToRoom;
  if (input.appliesToFood != null) patch.appliesToFood = input.appliesToFood;
  if (input.active != null) patch.active = input.active;
  await updateDoc(doc(db, "taxRates", id), patch);
}
