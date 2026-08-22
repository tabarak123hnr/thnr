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
  return {
    id,
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    department: String(data.department ?? ""),
    jobTitle: String(data.jobTitle ?? ""),
    shift: (data.shift as EmployeeShift) || "Morning",
    status: (data.status as EmployeeStatus) || "active",
    notes: String(data.notes ?? ""),
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
  department: string;
  jobTitle: string;
  shift: EmployeeShift;
  status: EmployeeStatus;
  notes: string;
}) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const ref = await addDoc(collection(db, "employees"), {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    department: input.department,
    jobTitle: input.jobTitle.trim(),
    shift: input.shift,
    status: input.status,
    notes: input.notes.trim(),
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
    department: string;
    jobTitle: string;
    shift: EmployeeShift;
    status: EmployeeStatus;
    notes: string;
  },
) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await updateDoc(doc(db, "employees", id), {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    department: input.department,
    jobTitle: input.jobTitle.trim(),
    shift: input.shift,
    status: input.status,
    notes: input.notes.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEmployee(id: string) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await deleteDoc(doc(db, "employees", id));
}
