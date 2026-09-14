import { EMPLOYEE_SHIFTS, type EmployeeShift } from "./employee";

export type DutyStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "missed"
  | "cancelled";
export type DutyShift = EmployeeShift;

export const DUTY_SHIFTS = EMPLOYEE_SHIFTS;

export const DEFAULT_DUTY_POINTS = 10;

export const DUTY_STATUSES: { value: DutyStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
  { value: "cancelled", label: "Cancelled" },
];

export const DUTY_CATEGORIES = [
  "Front desk",
  "Housekeeping",
  "Kitchen",
  "Restaurant",
  "Security",
  "Maintenance",
  "Parking",
  "Laundry",
  "Other",
] as const;

export type DutyCategory = (typeof DUTY_CATEGORIES)[number];

export interface DutyAssignment {
  id: string;
  title: string;
  category: DutyCategory;
  description: string;
  date: string;
  shift: DutyShift;
  status: DutyStatus;
  /** Points awarded if completed, deducted if missed */
  points: number;
  assigneeId: string | null;
  assigneeName: string | null;
  /** Supervisor who starts / signs the duty in */
  checkedInById: string | null;
  checkedInBy: string;
  /** Supervisor who ends / signs the duty out */
  checkedOutById: string | null;
  checkedOutBy: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}
