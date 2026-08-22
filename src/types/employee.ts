export type EmployeeStatus = "active" | "on_leave" | "inactive";
export type EmployeeShift = "Morning" | "Evening" | "Night" | "Split";

export const EMPLOYEE_DEPARTMENTS = [
  "Housekeeping",
  "Front desk",
  "Kitchen",
  "Service",
  "Accounts",
  "Maintenance",
  "Management",
] as const;

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
  department: string;
  jobTitle: string;
  shift: EmployeeShift;
  status: EmployeeStatus;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}
