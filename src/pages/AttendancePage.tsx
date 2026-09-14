import { Clock, LogIn, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, StatCard } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { todayIsoDate } from "../lib/dutyPerformance";
import { subscribeAttendance, clockInEmployee, clockOutEmployee, type AttendanceRecord } from "../services/attendance";
import { subscribeEmployees, type Employee } from "../services/employees";

function formatClockTime(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatClockDate(value: string) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDuration(fromIso: string, toIso: string | null, nowMs: number) {
  const start = new Date(fromIso).getTime();
  if (Number.isNaN(start)) return "—";
  const end = toIso ? new Date(toIso).getTime() : nowMs;
  if (Number.isNaN(end) || end < start) return "—";
  const totalMins = Math.floor((end - start) / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AttendancePage() {
  const { t } = useApp();
  const { profile, user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const recordedBy =
    profile?.name || user?.displayName || user?.email?.split("@")[0] || "";

  const [now, setNow] = useState(() => new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [logDate, setLogDate] = useState(todayIsoDate);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [pending, setPending] = useState<{
    action: "in" | "out";
    employee: Employee;
    openRecord?: AttendanceRecord;
  } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const a = subscribeEmployees(setEmployees);
    const b = subscribeAttendance(setRecords);
    return () => {
      a();
      b();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const today = todayIsoDate(now);
  const nowMs = now.getTime();

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees],
  );

  const todaysRecords = useMemo(
    () => records.filter((r) => r.date === today),
    [records, today],
  );

  const openByEmployee = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const row of records) {
      if (row.status === "clocked_in" && !row.clockOutAt && !map.has(row.employeeId)) {
        map.set(row.employeeId, row);
      }
    }
    return map;
  }, [records]);

  const board = useMemo(() => {
    return activeEmployees.map((employee) => {
      const open = openByEmployee.get(employee.id) ?? null;
      const todayRows = todaysRecords.filter((r) => r.employeeId === employee.id);
      const lastToday = todayRows[0] ?? null;
      return { employee, open, todayRows, lastToday };
    });
  }, [activeEmployees, openByEmployee, todaysRecords]);

  const logRows = useMemo(
    () => records.filter((r) => r.date === logDate),
    [records, logDate],
  );

  const stats = useMemo(() => {
    const clockedIn = board.filter((row) => row.open).length;
    const completed = todaysRecords.filter((r) => r.status === "clocked_out").length;
    const present = new Set(todaysRecords.map((r) => r.employeeId)).size;
    const absent = Math.max(0, activeEmployees.length - present);
    return { clockedIn, completed, present, absent };
  }, [board, todaysRecords, activeEmployees.length]);

  function openPunch(action: "in" | "out", employee: Employee, openRecord?: AttendanceRecord) {
    setPending({ action, employee, openRecord });
    setNote("");
  }

  async function confirmPunch() {
    if (!pending) return;
    setBusyId(pending.employee.id);
    const stamp = new Date().toISOString();
    try {
      if (pending.action === "in") {
        if (openByEmployee.has(pending.employee.id)) {
          throw new Error("This employee is already clocked in.");
        }
        await clockInEmployee({
          employeeId: pending.employee.id,
          employeeName: pending.employee.name,
          date: todayIsoDate(new Date(stamp)),
          clockInAt: stamp,
          recordedBy,
          notes: note,
        });
        toastSuccess(
          "Clocked in",
          `${pending.employee.name} · ${formatClockTime(stamp)}`,
        );
      } else {
        if (!pending.openRecord) throw new Error("No open clock-in found.");
        await clockOutEmployee({
          id: pending.openRecord.id,
          clockOutAt: stamp,
        });
        toastSuccess(
          "Clocked out",
          `${pending.employee.name} · ${formatClockTime(stamp)}`,
        );
      }
      setPending(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save attendance.";
      toastError("Attendance failed", message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.attendanceTitle}
        subtitle={t.pages.attendanceSub}
        actions={
          <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-app bg-app px-4 py-3 sm:w-auto">
            <Clock className="h-5 w-5 text-[var(--accent)]" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                Current time
              </p>
              <p className="font-extrabold tabular-nums tracking-tight">
                {now.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </div>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clocked in" value={String(stats.clockedIn)} hint="On duty right now" />
        <StatCard label="Present today" value={String(stats.present)} hint="At least one punch today" />
        <StatCard label="Clocked out" value={String(stats.completed)} hint="Shifts finished today" />
        <StatCard label="No punch yet" value={String(stats.absent)} hint="Active staff not marked today" />
      </div>

      {activeEmployees.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Add active employees first, then clock them in here.</p>
        </Card>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {board.map(({ employee, open, lastToday }) => {
            const working = Boolean(open);
            return (
              <Card key={employee.id} className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-sm font-extrabold text-[var(--accent-text)]">
                    {initials(employee.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold tracking-tight">{employee.name}</p>
                    <p className="text-xs text-muted">
                      {employee.designation || "Staff"} · {employee.shift}
                    </p>
                  </div>
                  <Badge tone={working ? "success" : lastToday ? "gold" : "muted"}>
                    {working ? "In" : lastToday ? "Out" : "Away"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-app px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                      Clock in
                    </p>
                    <p className="mt-0.5 font-semibold">
                      {formatClockTime(open?.clockInAt || lastToday?.clockInAt || "")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-app px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                      {working ? "Duration" : "Clock out"}
                    </p>
                    <p className="mt-0.5 font-semibold">
                      {working
                        ? formatDuration(open!.clockInAt, null, nowMs)
                        : formatClockTime(lastToday?.clockOutAt || "")}
                    </p>
                  </div>
                </div>

                {working ? (
                  <Button
                    type="button"
                    variant="gold"
                    className="w-full"
                    disabled={busyId === employee.id}
                    icon={<LogOut className="h-4 w-4" />}
                    onClick={() => openPunch("out", employee, open!)}
                  >
                    Clock out now
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={busyId === employee.id}
                    icon={<LogIn className="h-4 w-4" />}
                    onClick={() => openPunch("in", employee)}
                  >
                    Clock in now
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight">Attendance log</h2>
            <p className="text-sm text-muted">Punches saved with the live clock time.</p>
          </div>
          <div className="w-full sm:w-44">
            <Field label="Date">
              <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            </Field>
          </div>
        </div>
        <Table
          headers={["Employee", "Clock in", "Clock out", "Duration", "By"]}
          colWidths={["24%", "18%", "18%", "16%", "24%"]}
        >
          {logRows.length === 0 ? (
            <Tr>
              <Td className="text-muted" colSpan={5}>
                No attendance for {formatClockDate(logDate)}.
              </Td>
            </Tr>
          ) : (
            logRows.map((row) => (
              <Tr key={row.id}>
                <Td className="font-semibold">{row.employeeName}</Td>
                <Td>{formatClockTime(row.clockInAt)}</Td>
                <Td>{row.clockOutAt ? formatClockTime(row.clockOutAt) : "—"}</Td>
                <Td>{formatDuration(row.clockInAt, row.clockOutAt, nowMs)}</Td>
                <Td className="text-muted">{row.recordedBy || "—"}</Td>
              </Tr>
            ))
          )}
        </Table>
      </Card>

      <Modal
        open={Boolean(pending)}
        onClose={() => {
          if (busyId) return;
          setPending(null);
        }}
        title={pending?.action === "out" ? "Clock out" : "Clock in"}
        subtitle={
          pending
            ? `${pending.employee.name} · ${pending.employee.designation || "Staff"}`
            : undefined
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(busyId)}
              onClick={() => setPending(null)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              variant={pending?.action === "out" ? "gold" : "primary"}
              disabled={Boolean(busyId)}
              onClick={() => void confirmPunch()}
            >
              {busyId
                ? "Saving…"
                : pending?.action === "out"
                  ? "Clock out"
                  : "Clock in"}
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-app bg-app px-4 py-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Current time
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">
                {now.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
              <p className="mt-1 text-sm text-muted">{formatClockDate(today)}</p>
            </div>
            {pending.action === "out" && pending.openRecord ? (
              <p className="text-sm text-muted">
                Clocked in at {formatClockTime(pending.openRecord.clockInAt)} · worked{" "}
                {formatDuration(pending.openRecord.clockInAt, null, nowMs)} so far.
              </p>
            ) : (
              <Field label="Note (optional)">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Late, split shift, covering…"
                />
              </Field>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
