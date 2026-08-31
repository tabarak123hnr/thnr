export type EmployeeStatus = "active" | "on_leave" | "inactive";
export type EmployeeShift = "Morning" | "Evening" | "Night" | "Split";

export const EMPLOYEE_SHIFTS: EmployeeShift[] = [
  "Morning",
  "Evening",
  "Night",
  "Split",
];

export interface Employee {
  id: string;
  name: string;
  phone: string;
  email: string;
  /** Role / designation (e.g. Room attendant, Supervisor) */
  designation: string;
  shift: EmployeeShift;
  status: EmployeeStatus;
  notes: string;
  cnicFrontImageUrl: string | null;
  cnicBackImageUrl: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}
