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
import type { AttendanceRecord, AttendanceStatus } from "../types/attendance";

export type { AttendanceRecord, AttendanceStatus };

function asStatus(value: unknown): AttendanceStatus {
  return value === "clocked_out" ? "clocked_out" : "clocked_in";
}

function mapRecord(id: string, data: Record<string, unknown>): AttendanceRecord {
  const clockOutAt = data.clockOutAt ? String(data.clockOutAt) : null;
  return {
    id,
    employeeId: String(data.employeeId ?? ""),
    employeeName: String(data.employeeName ?? ""),
    date: String(data.date ?? "").slice(0, 10),
    clockInAt: String(data.clockInAt ?? ""),
    clockOutAt,
    status: clockOutAt ? "clocked_out" : asStatus(data.status),
    notes: String(data.notes ?? ""),
    recordedBy: String(data.recordedBy ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

export function subscribeAttendance(
  onData: (rows: AttendanceRecord[]) => void,
): Unsubscribe {
  const q = query(collection(db, "attendance"), orderBy("clockInAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapRecord(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

export async function clockInEmployee(input: {
  employeeId: string;
  employeeName: string;
  date: string;
  clockInAt: string;
  recordedBy: string;
  notes?: string;
}) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  if (!input.employeeId) throw new Error("Select an employee.");
  const ref = await addDoc(collection(db, "attendance"), {
    employeeId: input.employeeId,
    employeeName: input.employeeName.trim(),
    date: input.date.slice(0, 10),
    clockInAt: input.clockInAt,
    clockOutAt: null,
    status: "clocked_in",
    notes: (input.notes ?? "").trim(),
    recordedBy: input.recordedBy.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });
  return ref.id;
}

export async function clockOutEmployee(input: {
  id: string;
  clockOutAt: string;
}) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await updateDoc(doc(db, "attendance", input.id), {
    clockOutAt: input.clockOutAt,
    status: "clocked_out",
    updatedAt: serverTimestamp(),
  });
}

export async function updateAttendanceTimes(input: {
  id: string;
  clockInAt?: string;
  clockOutAt?: string | null;
}) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.clockInAt != null) patch.clockInAt = input.clockInAt;
  if (input.clockOutAt !== undefined) {
    patch.clockOutAt = input.clockOutAt;
    patch.status = input.clockOutAt ? "clocked_out" : "clocked_in";
  }
  await updateDoc(doc(db, "attendance", input.id), patch);
}
