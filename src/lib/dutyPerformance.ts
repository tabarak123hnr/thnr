import { DEFAULT_DUTY_POINTS, type DutyAssignment } from "../types/duty";

export function todayIsoDate(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function dutyPoints(duty: { points?: number | null }) {
  const n = Number(duty.points);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DUTY_POINTS;
  return Math.round(n);
}

export function isDutyMissed(duty: DutyAssignment, today: string) {
  if (!duty.assigneeId || duty.status === "cancelled") return false;
  if (duty.status === "missed") return true;
  if (duty.status === "completed") return false;
  return Boolean(duty.date && duty.date < today);
}

export function scoreLabel(score: number, hasScoredTasks: boolean) {
  if (!hasScoredTasks) return "No scored tasks";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Needs improvement";
}

export function scoreTone(
  score: number,
  hasScoredTasks: boolean,
): "success" | "gold" | "warning" | "danger" | "muted" {
  if (!hasScoredTasks) return "muted";
  if (score >= 90) return "success";
  if (score >= 75) return "gold";
  if (score >= 50) return "warning";
  return "danger";
}

export type EmployeeDutyScore = {
  employeeId: string;
  employeeName: string;
  designation: string;
  assigned: number;
  completed: number;
  missed: number;
  pending: number;
  earnedPoints: number;
  deductedPoints: number;
  pendingPoints: number;
  score: number;
  hasScoredTasks: boolean;
  label: string;
};

export function scoreEmployeeDuties(
  duties: DutyAssignment[],
  employee: { id: string; name: string; designation?: string },
  today: string,
): EmployeeDutyScore {
  const assigned = duties.filter(
    (d) => d.assigneeId === employee.id && d.status !== "cancelled",
  );
  const completed = assigned.filter((d) => d.status === "completed");
  const missed = assigned.filter((d) => isDutyMissed(d, today));
  const pending = assigned.filter(
    (d) =>
      d.status !== "completed" &&
      d.status !== "missed" &&
      !isDutyMissed(d, today),
  );

  const earnedPoints = completed.reduce((sum, d) => sum + dutyPoints(d), 0);
  const deductedPoints = missed.reduce((sum, d) => sum + dutyPoints(d), 0);
  const pendingPoints = pending.reduce((sum, d) => sum + dutyPoints(d), 0);
  const hasScoredTasks = earnedPoints + deductedPoints > 0;
  const score = hasScoredTasks
    ? Math.max(0, Math.round((earnedPoints / (earnedPoints + deductedPoints)) * 100))
    : 100;

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    designation: employee.designation || "",
    assigned: assigned.length,
    completed: completed.length,
    missed: missed.length,
    pending: pending.length,
    earnedPoints,
    deductedPoints,
    pendingPoints,
    score,
    hasScoredTasks,
    label: scoreLabel(score, hasScoredTasks),
  };
}

export function weekStartIso(today: string) {
  const d = new Date(`${today}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return todayIsoDate(d);
}

export function dutiesInPeriod(
  duties: DutyAssignment[],
  period: "today" | "week" | "all",
  today: string,
) {
  if (period === "all") return duties;
  if (period === "today") return duties.filter((d) => d.date === today);
  const start = weekStartIso(today);
  return duties.filter((d) => d.date >= start && d.date <= today);
}
