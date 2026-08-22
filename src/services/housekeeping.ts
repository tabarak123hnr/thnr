import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type {
  HousekeepingPriority,
  HousekeepingTask,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
} from "../types/housekeeping";

export type {
  HousekeepingPriority,
  HousekeepingTask,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
};

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
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    completedAt: data.completedAt,
  };
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    completedAt: null,
  });

  if (status === "in_progress" || status === "done") {
    await applyRoomCleaningSideEffects(input.roomId, status, input.assigneeName);
  }
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
  },
) {
  if (!auth.currentUser) throw new Error("You must be signed in.");

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
  if (input.status === "done") {
    patch.completedAt = serverTimestamp();
  }

  await updateDoc(doc(db, "housekeepingTasks", id), patch);
  await applyRoomCleaningSideEffects(input.roomId, input.status, input.assigneeName);
}
