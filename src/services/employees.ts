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
import type {
  Employee,
  EmployeeShift,
  EmployeeStatus,
} from "../types/employee";

export type { Employee, EmployeeShift, EmployeeStatus };

function mapEmployee(id: string, data: Record<string, unknown>): Employee {
  // Prefer designation; fall back to legacy jobTitle / department
  const designation = String(
    data.designation ?? data.jobTitle ?? data.department ?? "",
  );
  return {
    id,
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    designation,
    shift: (data.shift as EmployeeShift) || "Morning",
    status: (data.status as EmployeeStatus) || "active",
    notes: String(data.notes ?? ""),
    cnicFrontImageUrl: data.cnicFrontImageUrl ? String(data.cnicFrontImageUrl) : null,
    cnicBackImageUrl: data.cnicBackImageUrl ? String(data.cnicBackImageUrl) : null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

export function subscribeEmployees(
  onData: (rows: Employee[]) => void,
): Unsubscribe {
  const q = query(collection(db, "employees"), orderBy("name"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapEmployee(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

export async function createEmployee(input: {
  name: string;
  phone: string;
  email: string;
  designation: string;
  shift: EmployeeShift;
  status: EmployeeStatus;
  notes: string;
  cnicFrontImageUrl?: string | null;
  cnicBackImageUrl?: string | null;
}) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const ref = await addDoc(collection(db, "employees"), {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    designation: input.designation.trim(),
    shift: input.shift,
    status: input.status,
    notes: input.notes.trim(),
    cnicFrontImageUrl: input.cnicFrontImageUrl ?? null,
    cnicBackImageUrl: input.cnicBackImageUrl ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });
  return ref.id;
}

export async function updateEmployee(
  id: string,
  input: {
    name: string;
    phone: string;
    email: string;
    designation: string;
    shift: EmployeeShift;
    status: EmployeeStatus;
    notes: string;
    cnicFrontImageUrl?: string | null;
    cnicBackImageUrl?: string | null;
  },
) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const patch: Record<string, unknown> = {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    designation: input.designation.trim(),
    shift: input.shift,
    status: input.status,
    notes: input.notes.trim(),
    updatedAt: serverTimestamp(),
  };
  if (input.cnicFrontImageUrl !== undefined) {
    patch.cnicFrontImageUrl = input.cnicFrontImageUrl;
  }
  if (input.cnicBackImageUrl !== undefined) {
    patch.cnicBackImageUrl = input.cnicBackImageUrl;
  }
  await updateDoc(doc(db, "employees", id), patch);
}

export async function deleteEmployee(id: string) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await deleteDoc(doc(db, "employees", id));
}
