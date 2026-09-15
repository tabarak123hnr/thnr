import { Clock, LogIn, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, Input, PageHeader, StatCard } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { todayIsoDate } from "../lib/dutyPerformance";
import {
  subscribeAttendance,
  clockInEmployee,
  clockOutEmployee,
  updateAttendanceTimes,
  type AttendanceRecord,
} from "../services/attendance";
import { subscribeEmployees, type Employee } from "../services/employees";

function formatClockTime(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** HH:MM for `<input type="time">` from an ISO stamp */
function isoToTimeInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Current local time as HH:MM */
function nowTimeInput(now = new Date()) {
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

/** Combine YYYY-MM-DD + HH:MM → ISO */
function dateAndTimeToIso(date: string, time: string) {
  const [hh = "0", mm = "0"] = time.split(":");
  const d = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(hh) || 0,
    Number(mm) || 0,
    0,
    0,
  );
  return d.toISOString();
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

  useEffect(() => {
    const a = subscribeEmployees(setEmployees);
    const b = subscribeAttendance(setRecords);
    return () => {
      a();
      b();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const today = todayIsoDate(now);
  const nowMs = now.getTime();

  const activeEmployees = useMemo(
    () =>
      employees
        .filter((e) => e.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name)),
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

  const dayRows = useMemo(() => {
    return activeEmployees.map((employee) => {
      const open = openByEmployee.get(employee.id) ?? null;
      const forDate = records.filter(
        (r) => r.employeeId === employee.id && r.date === logDate,
      );
      // Prefer open shift if it belongs on this date (or still open today)
      const openOnDate =
        open && (open.date === logDate || (logDate === today && !open.clockOutAt))
          ? open
          : null;
      const completed = forDate.find((r) => r.clockOutAt) ?? forDate[0] ?? null;
      const record = openOnDate || completed;
      return { employee, record, open: openOnDate };
    });
  }, [activeEmployees, openByEmployee, records, logDate, today]);

  const stats = useMemo(() => {
    const clockedIn = activeEmployees.filter((e) => openByEmployee.has(e.id)).length;
    const completed = todaysRecords.filter((r) => r.status === "clocked_out").length;
    const present = new Set(todaysRecords.map((r) => r.employeeId)).size;
    const absent = Math.max(0, activeEmployees.length - present);
    return { clockedIn, completed, present, absent };
  }, [activeEmployees, openByEmployee, todaysRecords]);

  async function handleClockIn(employee: Employee) {
    if (openByEmployee.has(employee.id)) {
      toastError("Already in", `${employee.name} is already clocked in.`);
      return;
    }
    setBusyId(employee.id);
    const stamp = dateAndTimeToIso(logDate, nowTimeInput(now));
    try {
      await clockInEmployee({
        employeeId: employee.id,
        employeeName: employee.name,
        date: logDate,
        clockInAt: stamp,
        recordedBy,
      });
      toastSuccess("Clocked in", `${employee.name} · ${formatClockTime(stamp)}`);
    } catch (err) {
      toastError(
        "Clock in failed",
        err instanceof Error ? err.message : "Could not save.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleClockOut(employee: Employee, open: AttendanceRecord) {
    setBusyId(employee.id);
    const stamp = dateAndTimeToIso(logDate, nowTimeInput(now));
    try {
      if (new Date(stamp).getTime() < new Date(open.clockInAt).getTime()) {
        throw new Error("Clock-out time must be after clock-in.");
      }
      await clockOutEmployee({ id: open.id, clockOutAt: stamp });
      toastSuccess("Clocked out", `${employee.name} · ${formatClockTime(stamp)}`);
    } catch (err) {
      toastError(
        "Clock out failed",
        err instanceof Error ? err.message : "Could not save.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function saveClockInTime(record: AttendanceRecord, time: string) {
    if (!time) return;
    const next = dateAndTimeToIso(record.date || logDate, time);
    if (isoToTimeInput(record.clockInAt) === time) return;
    if (record.clockOutAt && new Date(next) > new Date(record.clockOutAt)) {
      toastError("Invalid time", "Clock-in must be before clock-out.");
      return;
    }
    setBusyId(record.employeeId);
    try {
      await updateAttendanceTimes({ id: record.id, clockInAt: next });
      toastSuccess("Clock-in updated", formatClockTime(next));
    } catch (err) {
      toastError(
        "Update failed",
        err instanceof Error ? err.message : "Could not update time.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function saveClockOutTime(record: AttendanceRecord, time: string) {
    if (!time) return;
    const next = dateAndTimeToIso(record.date || logDate, time);
    if (record.clockOutAt && isoToTimeInput(record.clockOutAt) === time) return;
    if (new Date(next) < new Date(record.clockInAt)) {
      toastError("Invalid time", "Clock-out must be after clock-in.");
      return;
    }
    setBusyId(record.employeeId);
    try {
      await updateAttendanceTimes({ id: record.id, clockOutAt: next });
      toastSuccess("Clock-out updated", formatClockTime(next));
    } catch (err) {
      toastError(
        "Update failed",
        err instanceof Error ? err.message : "Could not update time.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.attendanceTitle}
        subtitle="Clock staff in and out from the list. Times default to now and can be edited."
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

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight">Staff attendance</h2>
            <p className="text-sm text-muted">
              {activeEmployees.length} employee{activeEmployees.length === 1 ? "" : "s"} ·{" "}
              {formatClockDate(logDate)}
            </p>
          </div>
          <div className="w-full sm:w-44">
            <Field label="Date">
              <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            </Field>
          </div>
        </div>

        {activeEmployees.length === 0 ? (
          <p className="text-sm text-muted">Add active employees first, then clock them in here.</p>
        ) : (
          <Table
            bordered
            headers={["Employee", "Clock in", "Clock out", "Duration", "Status"]}
            colWidths={["26%", "20%", "20%", "14%", "20%"]}
          >
            {dayRows.map(({ employee, record, open }) => {
              const working = Boolean(open);
              const done = Boolean(record?.clockOutAt);
              const busy = busyId === employee.id;
              return (
                <Tr key={employee.id} bordered>
                  <Td bordered>
                    <p className="font-semibold">{employee.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {employee.designation || "Staff"} · {employee.shift}
                    </p>
                  </Td>
                  <Td bordered>
                    {record ? (
                      <Input
                        type="time"
                        className="max-w-[9.5rem]"
                        defaultValue={isoToTimeInput(record.clockInAt)}
                        key={`${record.id}-in-${record.clockInAt}`}
                        disabled={busy}
                        onBlur={(e) => {
                          void saveClockInTime(record, e.target.value);
                        }}
                      />
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || openByEmployee.has(employee.id)}
                        icon={<LogIn className="h-3.5 w-3.5" />}
                        onClick={() => void handleClockIn(employee)}
                      >
                        {busy ? "…" : "Clock in"}
                      </Button>
                    )}
                  </Td>
                  <Td bordered>
                    {done && record?.clockOutAt ? (
                      <Input
                        type="time"
                        className="max-w-[9.5rem]"
                        defaultValue={isoToTimeInput(record.clockOutAt)}
                        key={`${record.id}-out-${record.clockOutAt}`}
                        disabled={busy}
                        onBlur={(e) => {
                          void saveClockOutTime(record, e.target.value);
                        }}
                      />
                    ) : working && open ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="gold"
                        disabled={busy}
                        icon={<LogOut className="h-3.5 w-3.5" />}
                        onClick={() => void handleClockOut(employee, open)}
                      >
                        {busy ? "…" : "Clock out"}
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="secondary" disabled>
                        Clock out
                      </Button>
                    )}
                  </Td>
                  <Td bordered className="tabular-nums">
                    {record
                      ? formatDuration(record.clockInAt, record.clockOutAt, nowMs)
                      : "—"}
                  </Td>
                  <Td bordered>
                    <Badge tone={working ? "success" : done ? "gold" : "muted"}>
                      {working ? "In" : done ? "Out" : "Away"}
                    </Badge>
                  </Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
