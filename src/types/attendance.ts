export type AttendanceStatus = "clocked_in" | "clocked_out";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  clockInAt: string;
  clockOutAt: string | null;
  status: AttendanceStatus;
  notes: string;
  recordedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}
