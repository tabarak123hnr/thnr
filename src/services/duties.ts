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
import { dutyPoints } from "../lib/dutyPerformance";
import {
  DEFAULT_DUTY_POINTS,
  DUTY_CATEGORIES,
  type DutyAssignment,
  type DutyCategory,
  type DutyShift,
  type DutyStatus,
} from "../types/duty";

export type {
  DutyAssignment,
  DutyCategory,
  DutyShift,
  DutyStatus,
};

function asCategory(value: unknown): DutyCategory {
  const s = String(value ?? "");
  return (DUTY_CATEGORIES as readonly string[]).includes(s)
    ? (s as DutyCategory)
    : "Other";
}

function asStatus(value: unknown): DutyStatus {
  const s = String(value ?? "");
  if (
    s === "scheduled" ||
    s === "in_progress" ||
    s === "completed" ||
    s === "missed" ||
    s === "cancelled"
  ) {
    return s;
  }
  return "scheduled";
}

function asShift(value: unknown): DutyShift {
  const s = String(value ?? "");
  if (s === "Morning" || s === "Evening" || s === "Night" || s === "Split") {
    return s;
  }
  return "Morning";
}

function mapDuty(id: string, data: Record<string, unknown>): DutyAssignment {
  return {
    id,
    title: String(data.title ?? data.task ?? ""),
    category: asCategory(data.category),
    description: String(data.description ?? ""),
    date: String(data.date ?? "").slice(0, 10),
    shift: asShift(data.shift),
    status: asStatus(data.status),
    points: dutyPoints({ points: Number(data.points) || DEFAULT_DUTY_POINTS }),
    assigneeId: data.assigneeId ? String(data.assigneeId) : null,
    assigneeName: data.assigneeName ? String(data.assigneeName) : null,
    checkedInById: data.checkedInById ? String(data.checkedInById) : null,
    checkedInBy: String(data.checkedInBy ?? ""),
    checkedOutById: data.checkedOutById ? String(data.checkedOutById) : null,
    checkedOutBy: String(data.checkedOutBy ?? ""),
    notes: String(data.notes ?? ""),
    housekeepingTaskId: data.housekeepingTaskId
      ? String(data.housekeepingTaskId)
      : null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

export function subscribeDuties(
  onData: (rows: DutyAssignment[]) => void,
): Unsubscribe {
  const q = query(collection(db, "dutyRoster"), orderBy("date", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapDuty(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

export type DutyInput = {
  title: string;
  category: DutyCategory;
  description: string;
  date: string;
  shift: DutyShift;
  status: DutyStatus;
  points: number;
  assigneeId: string | null;
  assigneeName: string | null;
  checkedInById: string | null;
  checkedInBy: string;
  checkedOutById: string | null;
  checkedOutBy: string;
  notes: string;
  housekeepingTaskId?: string | null;
};

export function dutyToInput(
  duty: DutyAssignment,
  patch: Partial<DutyInput> = {},
): DutyInput {
  return {
    title: duty.title,
    category: duty.category,
    description: duty.description,
    date: duty.date,
    shift: duty.shift,
    status: duty.status,
    points: duty.points,
    assigneeId: duty.assigneeId,
    assigneeName: duty.assigneeName,
    checkedInById: duty.checkedInById,
    checkedInBy: duty.checkedInBy,
    checkedOutById: duty.checkedOutById,
    checkedOutBy: duty.checkedOutBy,
    notes: duty.notes,
    housekeepingTaskId: duty.housekeepingTaskId,
    ...patch,
  };
}

function payloadFromInput(input: DutyInput) {
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    category: input.category,
    description: input.description.trim(),
    date: input.date.slice(0, 10),
    shift: input.shift,
    status: input.status,
    points: dutyPoints(input),
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName?.trim() || null,
    checkedInById: input.checkedInById,
    checkedInBy: input.checkedInBy.trim(),
    checkedOutById: input.checkedOutById,
    checkedOutBy: input.checkedOutBy.trim(),
    notes: input.notes.trim(),
  };
  if (input.housekeepingTaskId !== undefined) {
    payload.housekeepingTaskId = input.housekeepingTaskId || null;
  }
  return payload;
}

export async function createDuty(input: DutyInput) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  if (!input.title.trim()) throw new Error("Duty title is required.");
  if (!input.date) throw new Error("Date is required.");
  const ref = await addDoc(collection(db, "dutyRoster"), {
    ...payloadFromInput(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });
  return ref.id;
}

export async function createDuties(inputs: DutyInput[]) {
  const titles = inputs.filter((i) => i.title.trim());
  if (!titles.length) throw new Error("Add at least one task.");
  await Promise.all(titles.map((input) => createDuty(input)));
}

export async function updateDuty(id: string, input: DutyInput) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  if (!input.title.trim()) throw new Error("Duty title is required.");
  if (!input.date) throw new Error("Date is required.");
  await updateDoc(doc(db, "dutyRoster", id), {
    ...payloadFromInput(input),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDuty(id: string) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await deleteDoc(doc(db, "dutyRoster", id));
}
