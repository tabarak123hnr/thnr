import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { todayIsoDate } from "../lib/dutyPerformance";
import type {
  HousekeepingPriority,
  HousekeepingTask,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
} from "../types/housekeeping";
import { DEFAULT_DUTY_POINTS } from "../types/duty";
import type { DutyShift, DutyStatus } from "../types/duty";

export type {
  HousekeepingPriority,
  HousekeepingTask,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
};

export const HOUSEKEEPING_DUTY_POINTS = DEFAULT_DUTY_POINTS;

function mapTask(id: string, data: Record<string, unknown>): HousekeepingTask {
  return {
    id,
    roomId: String(data.roomId ?? ""),
    roomNumber: String(data.roomNumber ?? ""),
    type: (data.type as HousekeepingTaskType) || "checkout_clean",
    priority: (data.priority as HousekeepingPriority) || "normal",
    status: (data.status as HousekeepingTaskStatus) || "pending",
    assigneeId: data.assigneeId ? String(data.assigneeId) : null,
    assigneeName: data.assigneeName ? String(data.assigneeName) : null,
    dueAt: String(data.dueAt ?? ""),
    notes: String(data.notes ?? ""),
    dirtyRoomImageUrl: data.dirtyRoomImageUrl ? String(data.dirtyRoomImageUrl) : null,
    cleanRoomImageUrl: data.cleanRoomImageUrl ? String(data.cleanRoomImageUrl) : null,
    dutyId: data.dutyId ? String(data.dutyId) : null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    completedAt: data.completedAt,
  };
}

function dutyStatusFromTask(status: HousekeepingTaskStatus): DutyStatus {
  if (status === "in_progress") return "in_progress";
  if (status === "done") return "completed";
  return "scheduled";
}

function dateFromDueAt(dueAt: string) {
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return todayIsoDate();
  return todayIsoDate(d);
}

function asDutyShift(value: unknown): DutyShift {
  const s = String(value ?? "");
  if (s === "Morning" || s === "Evening" || s === "Night" || s === "Split") {
    return s;
  }
  return "Morning";
}

async function findLinkedDutyId(taskId: string, storedDutyId?: string | null) {
  if (storedDutyId) {
    const snap = await getDoc(doc(db, "dutyRoster", storedDutyId));
    if (snap.exists()) return storedDutyId;
  }
  const snap = await getDocs(
    query(
      collection(db, "dutyRoster"),
      where("housekeepingTaskId", "==", taskId),
      limit(1),
    ),
  );
  return snap.docs[0]?.id ?? null;
}

async function lookupEmployeeShift(employeeId: string): Promise<DutyShift> {
  const snap = await getDoc(doc(db, "employees", employeeId));
  return asDutyShift(snap.data()?.shift);
}

/** Keep a 10-point Housekeeping duty on the roster in sync with the room task. */
async function syncLinkedHousekeepingDuty(
  taskId: string,
  input: {
    roomNumber: string;
    type: HousekeepingTaskType;
    status: HousekeepingTaskStatus;
    assigneeId: string | null;
    assigneeName: string | null;
    dueAt: string;
    notes: string;
    dutyId?: string | null;
  },
) {
  const existingId = await findLinkedDutyId(taskId, input.dutyId);

  if (!input.assigneeId) {
    if (existingId) {
      const snap = await getDoc(doc(db, "dutyRoster", existingId));
      const current = String(snap.data()?.status ?? "");
      if (current !== "completed" && current !== "cancelled") {
        await updateDoc(doc(db, "dutyRoster", existingId), {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        });
      }
    }
    return;
  }

  const dutyStatus = dutyStatusFromTask(input.status);
  const title = `Clean Room ${input.roomNumber}`;
  const description = [
    input.type.replace(/_/g, " "),
    input.notes.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  if (existingId) {
    const patch: Record<string, unknown> = {
      title,
      category: "Housekeeping",
      description,
      status: dutyStatus,
      points: HOUSEKEEPING_DUTY_POINTS,
      assigneeId: input.assigneeId,
      assigneeName: input.assigneeName,
      housekeepingTaskId: taskId,
      updatedAt: serverTimestamp(),
    };
    if (dutyStatus === "completed") {
      patch.checkedOutBy = input.assigneeName || "";
      patch.checkedOutById = input.assigneeId;
    }
    await updateDoc(doc(db, "dutyRoster", existingId), patch);
    if (input.dutyId !== existingId) {
      await updateDoc(doc(db, "housekeepingTasks", taskId), { dutyId: existingId });
    }
    return;
  }

  const shift = await lookupEmployeeShift(input.assigneeId);
  const ref = await addDoc(collection(db, "dutyRoster"), {
    title,
    category: "Housekeeping",
    description,
    date: dateFromDueAt(input.dueAt),
    shift,
    status: dutyStatus,
    points: HOUSEKEEPING_DUTY_POINTS,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    checkedInById: null,
    checkedInBy: "",
    checkedOutById: dutyStatus === "completed" ? input.assigneeId : null,
    checkedOutBy: dutyStatus === "completed" ? input.assigneeName || "" : "",
    notes: "",
    housekeepingTaskId: taskId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
  });
  await updateDoc(doc(db, "housekeepingTasks", taskId), { dutyId: ref.id });
}

export function subscribeHousekeepingTasks(
  onData: (rows: HousekeepingTask[]) => void,
): Unsubscribe {
  const q = query(collection(db, "housekeepingTasks"), orderBy("dueAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapTask(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

async function applyRoomCleaningSideEffects(
  roomId: string,
  status: HousekeepingTaskStatus,
  assigneeName: string | null,
) {
  if (!roomId) return;
  if (status === "in_progress") {
    await updateDoc(doc(db, "rooms", roomId), {
      cleaningStatus: "cleaning_in_progress",
      cleaningBy: assigneeName,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  if (status === "done") {
    const snap = await getDoc(doc(db, "rooms", roomId));
    const data = snap.data();
    const hasGuest = Boolean(data?.guest);
    await updateDoc(doc(db, "rooms", roomId), {
      cleaningStatus: "clean",
      cleanedBy: assigneeName,
      cleaningBy: null,
      lastCleanedAt: serverTimestamp(),
      ...(data?.status === "cleaning"
        ? { status: hasGuest ? "occupied" : "available" }
        : {}),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function createHousekeepingTask(input: {
  roomId: string;
  roomNumber: string;
  type: HousekeepingTaskType;
  priority: HousekeepingPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string;
  notes: string;
  status?: HousekeepingTaskStatus;
}) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const status = input.status ?? "pending";
  const ref = await addDoc(collection(db, "housekeepingTasks"), {
    roomId: input.roomId,
    roomNumber: input.roomNumber,
    type: input.type,
    priority: input.priority,
    status,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    dueAt: input.dueAt,
    notes: input.notes.trim(),
    dirtyRoomImageUrl: null,
    cleanRoomImageUrl: null,
    dutyId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    completedAt: null,
  });

  if (status === "in_progress" || status === "done") {
    await applyRoomCleaningSideEffects(input.roomId, status, input.assigneeName);
  }
  await syncLinkedHousekeepingDuty(ref.id, {
    roomNumber: input.roomNumber,
    type: input.type,
    status,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    dueAt: input.dueAt,
    notes: input.notes,
  });
  return ref.id;
}

export async function updateHousekeepingTask(
  id: string,
  input: {
    roomId: string;
    roomNumber: string;
    type: HousekeepingTaskType;
    priority: HousekeepingPriority;
    status: HousekeepingTaskStatus;
    assigneeId: string | null;
    assigneeName: string | null;
    dueAt: string;
    notes: string;
    dirtyRoomImageUrl?: string | null;
    cleanRoomImageUrl?: string | null;
  },
) {
  if (!auth.currentUser) throw new Error("You must be signed in.");

  const existing = await getDoc(doc(db, "housekeepingTasks", id));
  const existingData = existing.data() as Record<string, unknown> | undefined;

  const patch: Record<string, unknown> = {
    roomId: input.roomId,
    roomNumber: input.roomNumber,
    type: input.type,
    priority: input.priority,
    status: input.status,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    dueAt: input.dueAt,
    notes: input.notes.trim(),
    updatedAt: serverTimestamp(),
  };
  if (input.dirtyRoomImageUrl !== undefined) {
    patch.dirtyRoomImageUrl = input.dirtyRoomImageUrl;
  }
  if (input.cleanRoomImageUrl !== undefined) {
    patch.cleanRoomImageUrl = input.cleanRoomImageUrl;
  }
  if (input.status === "done") {
    patch.completedAt = serverTimestamp();
  }

  await updateDoc(doc(db, "housekeepingTasks", id), patch);
  await applyRoomCleaningSideEffects(input.roomId, input.status, input.assigneeName);
  await syncLinkedHousekeepingDuty(id, {
    roomNumber: input.roomNumber,
    type: input.type,
    status: input.status,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    dueAt: input.dueAt,
    notes: input.notes,
    dutyId: existingData?.dutyId ? String(existingData.dutyId) : null,
  });
}
