export type HousekeepingTaskType =
  | "checkout_clean"
  | "stayover"
  | "deep_clean"
  | "turndown"
  | "other";

export type HousekeepingPriority = "high" | "normal" | "low";
export type HousekeepingTaskStatus = "pending" | "in_progress" | "done";

export const HOUSEKEEPING_TASK_TYPES: {
  value: HousekeepingTaskType;
  label: string;
}[] = [
  { value: "checkout_clean", label: "Checkout clean" },
  { value: "stayover", label: "Stayover" },
  { value: "deep_clean", label: "Deep clean" },
  { value: "turndown", label: "Turndown" },
  { value: "other", label: "Other" },
];

export interface HousekeepingTask {
  id: string;
  roomId: string;
  roomNumber: string;
  type: HousekeepingTaskType;
  priority: HousekeepingPriority;
  status: HousekeepingTaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string;
  notes: string;
  /** Photo of the dirty room, captured when assigning a cleaner */
  dirtyRoomImageUrl: string | null;
  /** Photo of the clean room, captured when marking the task done */
  cleanRoomImageUrl: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  completedAt?: unknown;
}
