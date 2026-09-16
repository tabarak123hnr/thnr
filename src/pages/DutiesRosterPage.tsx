import {
  Check,
  Eye,
  Minus,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, StatCard } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import {
  dutiesInPeriod,
  dutyPoints,
  scoreEmployeeDuties,
  scoreTone,
  todayIsoDate,
} from "../lib/dutyPerformance";
import { cn } from "../lib/utils";
import { subscribeEmployees, type Employee } from "../services/employees";
import {
  createDuties,
  deleteDuty,
  dutyToInput,
  subscribeDuties,
  updateDuty,
  type DutyAssignment,
  type DutyCategory,
  type DutyShift,
  type DutyStatus,
} from "../services/duties";
import {
  HOUSEKEEPING_DUTY_POINTS,
  subscribeHousekeepingTasks,
  type HousekeepingTask,
} from "../services/housekeeping";
import {
  DEFAULT_DUTY_POINTS,
  DUTY_CATEGORIES,
  DUTY_SHIFTS,
  DUTY_STATUSES,
} from "../types/duty";

const statusTone: Record<DutyStatus, "gold" | "info" | "success" | "danger" | "muted"> = {
  scheduled: "gold",
  in_progress: "info",
  completed: "success",
  missed: "danger",
  cancelled: "muted",
};

const statusLabel: Record<DutyStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  missed: "Missed",
  cancelled: "Cancelled",
};

const hkStatusLabel: Record<HousekeepingTask["status"], string> = {
  pending: "Needs cleaning",
  in_progress: "Cleaning now",
  done: "Done",
};

type PageTab = "roster" | "daily" | "performance";
type ScorePeriod = "today" | "week" | "all";

function formatDutyDate(value: string) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function emptyDailyRow() {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    points: String(DEFAULT_DUTY_POINTS),
    category: "Other" as DutyCategory,
  };
}

function isRoomDuty(row: DutyAssignment) {
  return Boolean(row.housekeepingTaskId) || /^Clean Room /i.test(row.title);
}

function dutyShowsOnDay(
  duty: DutyAssignment,
  day: string,
  today: string,
  hkTasks: HousekeepingTask[],
) {
  if (duty.status === "cancelled") return false;
  if (duty.date === day) return true;
  if (!duty.housekeepingTaskId) return false;
  const task = hkTasks.find((t) => t.id === duty.housekeepingTaskId);
  if (!task) return false;
  if (task.status !== "done") {
    return day === today && task.assigneeId === duty.assigneeId;
  }
  return Boolean(task.completedOn && task.completedOn === day);
}

function extraHousekeepingTasks(
  employeeId: string | undefined,
  allDuties: DutyAssignment[],
  hkTasks: HousekeepingTask[],
) {
  if (!employeeId) return [];
  const linkedTaskIds = new Set(
    allDuties.map((d) => d.housekeepingTaskId).filter((id): id is string => Boolean(id)),
  );
  const linkedDutyIds = new Set(allDuties.map((d) => d.id));
  const roomTitles = new Set(
    allDuties
      .filter((d) => d.assigneeId === employeeId && d.status !== "cancelled")
      .map((d) => d.title.trim().toLowerCase()),
  );
  return hkTasks.filter((task) => {
    if (task.assigneeId !== employeeId || task.status === "done") return false;
    if (linkedTaskIds.has(task.id)) return false;
    if (task.dutyId && linkedDutyIds.has(task.dutyId)) return false;
    if (roomTitles.has(`clean room ${task.roomNumber}`.toLowerCase())) return false;
    return true;
  });
}

function employeeOptions(employees: Employee[], emptyLabel = "Select employee") {
  const active = employees.filter((e) => e.status === "active");
  return [
    { value: "", label: emptyLabel },
    ...active.map((e) => ({
      value: e.id,
      label: e.name,
      description: e.designation || undefined,
    })),
  ];
}

export function DutiesRosterPage() {
  const { t } = useApp();
  const { profile, user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const staffDisplayName =
    profile?.name || user?.displayName || user?.email?.split("@")[0] || "";

  const [tab, setTab] = useState<PageTab>("daily");
  const [duties, setDuties] = useState<DutyAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [rosterDate, setRosterDate] = useState(todayIsoDate);
  const [dailyDate, setDailyDate] = useState(todayIsoDate);
  const [scorePeriod, setScorePeriod] = useState<ScorePeriod>("week");
  const [search, setSearch] = useState("");

  const [dailyOpen, setDailyOpen] = useState(false);
  const [dailySaving, setDailySaving] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailyForm, setDailyForm] = useState({
    date: todayIsoDate(),
    shift: "Morning" as DutyShift,
    assigneeId: "",
    supervisorId: "",
    tasks: [emptyDailyRow()],
  });

  const [editRow, setEditRow] = useState<DutyAssignment | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState<DutyStatus>("scheduled");
  const [editSaving, setEditSaving] = useState(false);

  const [viewRow, setViewRow] = useState<DutyAssignment | null>(null);
  const [deleteRow, setDeleteRow] = useState<DutyAssignment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [missRow, setMissRow] = useState<DutyAssignment | null>(null);
  const [missing, setMissing] = useState(false);

  const [signDuty, setSignDuty] = useState<DutyAssignment | null>(null);
  const [signAction, setSignAction] = useState<"start" | "complete" | null>(null);
  const [signSupervisorId, setSignSupervisorId] = useState("");
  const [signSaving, setSignSaving] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  useEffect(() => {
    const a = subscribeDuties(setDuties);
    const b = subscribeEmployees(setEmployees);
    const c = subscribeHousekeepingTasks(setHousekeepingTasks);
    return () => {
      a();
      b();
      c();
    };
  }, []);

  const today = todayIsoDate();

  const rosterDuties = useMemo(() => {
    return duties.map((d) => {
      if (!d.housekeepingTaskId && !isRoomDuty(d)) return d;
      const task = d.housekeepingTaskId
        ? housekeepingTasks.find((t) => t.id === d.housekeepingTaskId)
        : undefined;
      if (d.status === "completed") {
        return {
          ...d,
          points: HOUSEKEEPING_DUTY_POINTS,
          date: task?.completedOn || d.date || today,
        };
      }
      return {
        ...d,
        points: HOUSEKEEPING_DUTY_POINTS,
        date: today,
      };
    });
  }, [duties, housekeepingTasks, today]);

  const filtered = useMemo(() => {
    return rosterDuties.filter((row) =>
      dutyShowsOnDay(row, rosterDate, today, housekeepingTasks),
    );
  }, [rosterDuties, rosterDate, today, housekeepingTasks]);

  const searchedRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((row) => {
      const employee = employees.find((e) => e.id === row.assigneeId);
      const name = (employee?.name || row.assigneeName || "Unassigned").toLowerCase();
      const desig = (employee?.designation || "").toLowerCase();
      const title = (row.title || "").toLowerCase();
      const category = (row.category || "").toLowerCase();
      const shift = (row.shift || "").toLowerCase();
      const status = (statusLabel[row.status] || row.status || "").toLowerCase();
      const sup = (row.checkedInBy || "").toLowerCase();
      return (
        name.includes(q) ||
        desig.includes(q) ||
        title.includes(q) ||
        category.includes(q) ||
        shift.includes(q) ||
        status.includes(q) ||
        sup.includes(q)
      );
    });
  }, [filtered, search, employees]);

  const dailyDuties = useMemo(
    () =>
      rosterDuties.filter((d) => dutyShowsOnDay(d, dailyDate, today, housekeepingTasks)),
    [rosterDuties, dailyDate, today, housekeepingTasks],
  );

  const dailyGroups = useMemo(() => {
    const byId = new Map<
      string,
      { employee: Employee | null; name: string; assigneeId: string | null; rows: DutyAssignment[] }
    >();
    for (const row of dailyDuties) {
      const key = row.assigneeId || "unassigned";
      const existing = byId.get(key);
      if (existing) {
        existing.rows.push(row);
        continue;
      }
      const employee = employees.find((e) => e.id === row.assigneeId) ?? null;
      byId.set(key, {
        employee,
        name: employee?.name || row.assigneeName || "Unassigned",
        assigneeId: row.assigneeId,
        rows: [row],
      });
    }
    if (dailyDate === today) {
      for (const task of housekeepingTasks) {
        if (!task.assigneeId || task.status === "done") continue;
        if (byId.has(task.assigneeId)) continue;
        if (!extraHousekeepingTasks(task.assigneeId, duties, housekeepingTasks).length) {
          continue;
        }
        const employee = employees.find((e) => e.id === task.assigneeId) ?? null;
        byId.set(task.assigneeId, {
          employee,
          name: employee?.name || task.assigneeName || "Unassigned",
          assigneeId: task.assigneeId,
          rows: [],
        });
      }
    }
    for (const group of byId.values()) {
      group.rows.sort((a, b) => {
        const rank = (status: DutyStatus) =>
          status === "completed" || status === "missed" ? 1 : 0;
        return rank(a.status) - rank(b.status);
      });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [dailyDuties, employees, housekeepingTasks, dailyDate, today, duties]);

  const searchedDailyGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dailyGroups;
    return dailyGroups
      .map((group) => {
        const nameMatches = group.name.toLowerCase().includes(q);
        const desigMatches = (group.employee?.designation || "").toLowerCase().includes(q);
        if (nameMatches || desigMatches) return group;
        const matchingRows = group.rows.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            r.shift.toLowerCase().includes(q),
        );
        if (matchingRows.length > 0) {
          return { ...group, rows: matchingRows };
        }
        return null;
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [dailyGroups, search]);

  const scoredDuties = useMemo(
    () => dutiesInPeriod(rosterDuties, scorePeriod, today),
    [rosterDuties, scorePeriod, today],
  );

  const performance = useMemo(() => {
    const active = employees.filter((e) => e.status === "active");
    return active
      .map((employee) => scoreEmployeeDuties(scoredDuties, employee, today))
      .sort((a, b) => b.score - a.score || a.employeeName.localeCompare(b.employeeName));
  }, [employees, scoredDuties, today]);

  const searchedPerformance = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return performance;
    return performance.filter(
      (row) =>
        row.employeeName.toLowerCase().includes(q) ||
        (row.designation || "").toLowerCase().includes(q),
    );
  }, [performance, search]);

  const performanceById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof scoreEmployeeDuties>>();
    for (const row of performance) map.set(row.employeeId, row);
    return map;
  }, [performance]);

  const stats = useMemo(() => {
    const todays = rosterDuties.filter((d) => d.date === today);
    const scoredToday = todays.filter((d) => d.status !== "cancelled" && d.assigneeId);
    const completedToday = scoredToday.filter((d) => d.status === "completed");
    return {
      today: todays.length,
      inProgress: rosterDuties.filter((d) => d.status === "in_progress").length,
      completedToday: completedToday.length,
      missed: rosterDuties.filter(
        (d) =>
          d.status === "missed" ||
          (d.date < today &&
            d.status !== "completed" &&
            d.status !== "cancelled" &&
            d.assigneeId),
      ).length,
    };
  }, [rosterDuties, today]);

  function findSelf() {
    return employees.find(
      (e) =>
        e.status === "active" &&
        (e.name.toLowerCase() === staffDisplayName.toLowerCase() ||
          (e.email && user?.email && e.email.toLowerCase() === user.email.toLowerCase())),
    );
  }

  function openDailyCreate(assigneeId = "") {
    const self = findSelf();
    setDailyForm({
      date: dailyDate || todayIsoDate(),
      shift: "Morning",
      assigneeId,
      supervisorId: self?.id || "",
      tasks: [emptyDailyRow()],
    });
    setDailyError(null);
    setDailyOpen(true);
  }

  async function submitDaily(e: React.FormEvent) {
    e.preventDefault();
    const assignee = employees.find((emp) => emp.id === dailyForm.assigneeId);
    if (!assignee) {
      setDailyError("Select the employee.");
      return;
    }
    const supervisor = employees.find((emp) => emp.id === dailyForm.supervisorId);
    if (!supervisor) {
      setDailyError("Select the supervisor assigning these tasks.");
      return;
    }
    const tasks = dailyForm.tasks.filter((row) => row.title.trim());
    if (!tasks.length) {
      setDailyError("Add at least one task.");
      return;
    }
    if (!dailyForm.date) {
      setDailyError("Date is required.");
      return;
    }
    setDailySaving(true);
    setDailyError(null);
    try {
      await createDuties(
        tasks.map((row) => ({
          title: row.title.trim(),
          category: row.category,
          description: "",
          date: dailyForm.date,
          shift: dailyForm.shift,
          status: "scheduled" as DutyStatus,
          points: Number(row.points) || DEFAULT_DUTY_POINTS,
          assigneeId: assignee.id,
          assigneeName: assignee.name,
          checkedInById: supervisor.id,
          checkedInBy: supervisor.name,
          checkedOutById: null,
          checkedOutBy: "",
          notes: "",
        })),
      );
      toastSuccess(
        "Tasks assigned",
        `${tasks.length} for ${assignee.name} · by ${supervisor.name}`,
      );
      setDailyOpen(false);
      setDailyDate(dailyForm.date);
      setTab("roster");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add tasks.";
      setDailyError(message);
      toastError("Save failed", message);
    } finally {
      setDailySaving(false);
    }
  }

  function openSign(row: DutyAssignment, action: "start" | "complete") {
    const self = findSelf();
    setSignDuty(row);
    setSignAction(action);
    setSignSupervisorId(row.checkedInById || self?.id || "");
    setSignError(null);
  }

  async function submitSign(e: React.FormEvent) {
    e.preventDefault();
    if (!signDuty || !signAction) return;
    if (!signDuty.assigneeId) {
      setSignError("Assign an employee before updating this task.");
      return;
    }
    const supervisor = employees.find((emp) => emp.id === signSupervisorId);
    if (!supervisor) {
      setSignError("Select the supervisor.");
      return;
    }
    setSignSaving(true);
    setSignError(null);
    try {
      if (signAction === "start") {
        await updateDuty(
          signDuty.id,
          dutyToInput(signDuty, {
            status: "in_progress",
            checkedInById: supervisor.id,
            checkedInBy: supervisor.name,
          }),
        );
        toastSuccess("Started", `${signDuty.title} · ${supervisor.name}`);
      } else {
        await updateDuty(
          signDuty.id,
          dutyToInput(signDuty, {
            status: "completed",
            checkedOutById: supervisor.id,
            checkedOutBy: supervisor.name,
          }),
        );
        toastSuccess("Completed", `${signDuty.title} · +${dutyPoints(signDuty)} pts`);
      }
      setSignDuty(null);
      setSignAction(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update task.";
      setSignError(message);
      toastError("Update failed", message);
    } finally {
      setSignSaving(false);
    }
  }

  async function confirmMissed() {
    if (!missRow) return;
    setMissing(true);
    try {
      await updateDuty(missRow.id, dutyToInput(missRow, { status: "missed" }));
      toastSuccess("Marked missed", `${missRow.title} · −${dutyPoints(missRow)} pts`);
      setMissRow(null);
    } catch (err) {
      toastError(
        "Update failed",
        err instanceof Error ? err.message : "Could not mark missed.",
      );
    } finally {
      setMissing(false);
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await deleteDuty(deleteRow.id);
      toastSuccess("Removed", deleteRow.title);
      setDeleteRow(null);
    } catch (err) {
      toastError("Delete failed", err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  function openEdit(row: DutyAssignment) {
    setEditRow(row);
    setEditTitle(row.title);
    setEditStatus(row.status);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    if (!editTitle.trim()) return;
    setEditSaving(true);
    try {
      await updateDuty(
        editRow.id,
        dutyToInput(editRow, { title: editTitle.trim(), status: editStatus }),
      );
      toastSuccess("Updated", editTitle.trim());
      setEditRow(null);
    } catch (err) {
      toastError("Save failed", err instanceof Error ? err.message : "Could not update.");
    } finally {
      setEditSaving(false);
    }
  }

  const assigneeOptions = employeeOptions(employees);
  const supervisorOptions = employeeOptions(employees, "Select supervisor");

  const tabs: { id: PageTab; label: string }[] = [
    { id: "daily", label: "Daily tasks" },
    { id: "roster", label: "Roster" },
    { id: "performance", label: "Performance" },
  ];

  return (
    <div>
      <PageHeader
        title={t.pages.dutiesTitle}
        subtitle={t.pages.dutiesSub}
        actions={
          <Button
            type="button"
            className="w-full shrink-0 cursor-pointer sm:w-auto"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => openDailyCreate()}
          >
            Assign daily tasks
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today" value={String(stats.today)} hint="Tasks on the roster today" />
        <StatCard label="In progress" value={String(stats.inProgress)} hint="Currently working" />
        <StatCard
          label="Completed today"
          value={String(stats.completedToday)}
          hint="Points earned today"
        />
        <StatCard
          label="Missed / overdue"
          value={String(stats.missed)}
          hint="Points deducted from score"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-app pb-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              tab === item.id
                ? "bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--accent)]"
                : "text-muted hover:bg-app hover:text-app",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "daily" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Day" className="w-full sm:w-52">
              <Input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
              />
            </Field>
            <div className="w-full sm:w-64">
              <Field label="Search daily tasks">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search staff, task, shift…"
                    className="h-10 rounded-xl ps-9 pe-8 text-sm"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted hover:text-[var(--text)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </Field>
            </div>
            <p className="pb-2 text-sm text-muted">
              {dailyDuties.length} task{dailyDuties.length === 1 ? "" : "s"} ·{" "}
              {formatDutyDate(dailyDate)}
            </p>
            <Button
              type="button"
              size="sm"
              className="ms-auto"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => openDailyCreate()}
            >
              Assign tasks
            </Button>
          </div>
          {searchedDailyGroups.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">
                {search
                  ? "No staff or daily tasks match your search."
                  : "No tasks for this day. Assign daily tasks to an employee with a supervisor."}
              </p>
            </Card>
          ) : (
            searchedDailyGroups.map((group) => {
              const score = group.employee
                ? scoreEmployeeDuties(dailyDuties, group.employee, today)
                : null;
              const open = group.rows.filter(
                (r) => r.status === "scheduled" || r.status === "in_progress",
              );
              const extraHk = extraHousekeepingTasks(
                group.assigneeId || group.employee?.id,
                duties,
                housekeepingTasks,
              );
              return (
                <Card key={group.assigneeId || group.name}>
                  <CardHeader
                    title={group.name}
                    badge={
                      score ? (
                        <Badge tone={scoreTone(score.score, score.hasScoredTasks)}>
                          {score.hasScoredTasks ? `${score.score}%` : "Pending"}
                        </Badge>
                      ) : null
                    }
                    action={
                      group.employee ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          icon={<Plus className="h-3.5 w-3.5" />}
                          onClick={() => openDailyCreate(group.employee!.id)}
                        >
                          Add tasks
                        </Button>
                      ) : null
                    }
                  />
                  {group.employee?.designation ? (
                    <p className="-mt-2 mb-3 text-xs text-muted">{group.employee.designation}</p>
                  ) : null}
                  <ul className="space-y-2">
                    {group.rows.map((row) => {
                      const fromHousekeeping = isRoomDuty(row);
                      const pts = dutyPoints(row);
                      return (
                        <li
                          key={row.id}
                          className="flex flex-col gap-2 rounded-xl border border-app bg-app px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                              {fromHousekeeping ? (
                                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                              ) : null}
                              {row.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted">
                              {fromHousekeeping ? "Housekeeping" : row.category}
                              {" · "}
                              {row.shift}
                              {row.checkedInBy ? ` · supervisor ${row.checkedInBy}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {row.status === "completed" ? (
                              <Badge tone="success">+{pts} pts</Badge>
                            ) : (
                              <Badge tone="gold">{pts} pts</Badge>
                            )}
                            <Badge tone={statusTone[row.status]}>
                              {statusLabel[row.status]}
                            </Badge>
                            {fromHousekeeping ? (
                              <Link
                                to="/housekeeping"
                                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-[var(--accent)] hover:underline"
                              >
                                Housekeeping
                              </Link>
                            ) : null}
                            {!fromHousekeeping && row.status === "scheduled" ? (
                              <Button
                                size="sm"
                                variant="gold"
                                icon={<Play className="h-3.5 w-3.5" />}
                                onClick={() => openSign(row, "start")}
                              >
                                Start
                              </Button>
                            ) : null}
                            {!fromHousekeeping && row.status === "in_progress" ? (
                              <Button
                                size="sm"
                                variant="gold"
                                icon={<Check className="h-3.5 w-3.5" />}
                                onClick={() => openSign(row, "complete")}
                              >
                                Done
                              </Button>
                            ) : null}
                            {!fromHousekeeping && open.includes(row) ? (
                              <Button
                                size="sm"
                                variant="danger"
                                icon={<XCircle className="h-3.5 w-3.5" />}
                                onClick={() => setMissRow(row)}
                              >
                                Missed
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500"
                              icon={<Eye className="h-3.5 w-3.5" />}
                              onClick={() => setViewRow(row)}
                            >
                              View
                            </Button>
                            {!fromHousekeeping ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={<Pencil className="h-3.5 w-3.5" />}
                                  onClick={() => openEdit(row)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  icon={<Trash2 className="h-3.5 w-3.5" />}
                                  onClick={() => setDeleteRow(row)}
                                >
                                  Delete
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                    {extraHk.map((task) => (
                      <li
                        key={`hk-${task.id}`}
                        className="flex flex-col gap-2 rounded-xl border border-app bg-app px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                            Clean Room {task.roomNumber}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">Housekeeping</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="gold">{HOUSEKEEPING_DUTY_POINTS} pts</Badge>
                          <Badge tone={task.status === "in_progress" ? "info" : "gold"}>
                            {hkStatusLabel[task.status]}
                          </Badge>
                          <Link
                            to="/housekeeping"
                            className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-[var(--accent)] hover:underline"
                          >
                            Housekeeping
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })
          )}
        </div>
      ) : null}

      {tab === "performance" ? (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-44">
              <Field label="Period">
                <FancySelect
                  value={scorePeriod}
                  onChange={(v) => setScorePeriod(v as ScorePeriod)}
                  options={[
                    { value: "today", label: "Today" },
                    { value: "week", label: "This week" },
                    { value: "all", label: "All time" },
                  ]}
                />
              </Field>
            </div>
            <div className="w-full sm:w-64">
              <Field label="Search staff">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search employee or role…"
                    className="h-10 rounded-xl ps-9 pe-8 text-sm"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted hover:text-[var(--text)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </Field>
            </div>
          </div>
          <Card>
            <Table
              headers={["Employee", "Done / assigned", "Earned", "Deducted", "Score"]}
              colWidths={["28%", "18%", "16%", "16%", "22%"]}
            >
              {searchedPerformance.length === 0 ? (
                <Tr>
                  <Td className="text-muted" colSpan={5}>
                    {search
                      ? "No employees match your search."
                      : "Add employees to track daily task scores."}
                  </Td>
                </Tr>
              ) : (
                searchedPerformance.map((row) => (
                  <Tr key={row.employeeId}>
                    <Td>
                      <p className="font-semibold">{row.employeeName}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {row.designation || "Staff"}
                        {row.pending ? ` · ${row.pending} still open` : ""}
                      </p>
                    </Td>
                    <Td>
                      {row.completed}/{row.assigned || 0}
                      {row.missed ? (
                        <span className="mt-0.5 block text-xs text-muted">
                          {row.missed} missed
                        </span>
                      ) : null}
                    </Td>
                    <Td className="font-semibold">+{row.earnedPoints}</Td>
                    <Td className="font-semibold text-red-600 dark:text-red-400">
                      −{row.deductedPoints}
                    </Td>
                    <Td>
                      <Badge tone={scoreTone(row.score, row.hasScoredTasks)}>
                        {row.hasScoredTasks ? `${row.score}% · ${row.label}` : row.label}
                      </Badge>
                    </Td>
                  </Tr>
                ))
              )}
            </Table>
          </Card>
        </div>
      ) : null}

      {tab === "roster" ? (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Date" className="w-full sm:w-52">
              <Input
                type="date"
                value={rosterDate}
                onChange={(e) => setRosterDate(e.target.value)}
              />
            </Field>
            <div className="w-full sm:w-64">
              <Field label="Search roster">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search staff, task, shift…"
                    className="h-10 rounded-xl ps-9 pe-8 text-sm"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted hover:text-[var(--text)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </Field>
            </div>
            <p className="pb-2 text-sm text-muted">
              {searchedRoster.length} of {filtered.length} task{filtered.length === 1 ? "" : "s"} ·{" "}
              {formatDutyDate(rosterDate)}
            </p>
          </div>
          <Card>
            <Table
              bordered
              headers={[
                "Employee name",
                "Designation",
                "Task",
                "Status",
                "Performance",
              ]}
              colWidths={["22%", "18%", "28%", "14%", "18%"]}
            >
              {searchedRoster.length === 0 ? (
                <Tr bordered>
                  <Td bordered className="text-muted" colSpan={5}>
                    {search
                      ? "No tasks match your search."
                      : "No tasks for this date. Assign daily tasks to staff."}
                  </Td>
                </Tr>
              ) : (
                searchedRoster.map((row) => {
                  const fromHousekeeping = isRoomDuty(row);
                  const employee = employees.find((e) => e.id === row.assigneeId);
                  const score = row.assigneeId
                    ? performanceById.get(row.assigneeId)
                    : undefined;
                  return (
                    <Tr key={row.id} bordered>
                      <Td bordered>
                        <p className="font-semibold">
                          {employee?.name || row.assigneeName || "Unassigned"}
                        </p>
                        {row.checkedInBy ? (
                          <p className="mt-0.5 text-xs text-muted">
                            Supervisor · {row.checkedInBy}
                          </p>
                        ) : null}
                      </Td>
                      <Td bordered className="text-muted">
                        {employee?.designation || "—"}
                      </Td>
                      <Td bordered>
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                          {fromHousekeeping ? (
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                          ) : null}
                          {row.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {fromHousekeeping ? "Housekeeping" : row.category} ·{" "}
                          {row.shift}
                        </p>
                      </Td>
                      <Td bordered>
                        <Badge tone={statusTone[row.status]}>
                          {statusLabel[row.status]}
                        </Badge>
                      </Td>
                      <Td bordered>
                        {score ? (
                          <Badge tone={scoreTone(score.score, score.hasScoredTasks)}>
                            {score.hasScoredTasks
                              ? `${score.score}% · ${score.label}`
                              : score.label}
                          </Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })
              )}
            </Table>
          </Card>
        </>
      ) : null}

      <Modal
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title={viewRow?.title ?? "Task"}
        subtitle={viewRow ? `${viewRow.category} · ${formatDutyDate(viewRow.date)}` : undefined}
        footer={
          <Button type="button" variant="secondary" onClick={() => setViewRow(null)}>
            Close
          </Button>
        }
      >
        {viewRow ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Employee" value={viewRow.assigneeName || "Unassigned"} />
            <Detail label="Status" value={statusLabel[viewRow.status]} />
            <Detail label="Supervisor" value={viewRow.checkedInBy || "—"} />
            <Detail
              label="Completed by"
              value={viewRow.checkedOutBy || "—"}
            />
            <Detail label="Points" value={String(dutyPoints(viewRow))} />
            <Detail label="Shift" value={viewRow.shift} />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={dailyOpen}
        onClose={() => {
          if (dailySaving) return;
          setDailyOpen(false);
        }}
        title="Assign daily tasks"
        subtitle="Pick employee + supervisor, then list the tasks."
        wide
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={dailySaving}
              onClick={() => setDailyOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" form="daily-tasks-form" disabled={dailySaving}>
              {dailySaving ? "Saving…" : "Assign tasks"}
            </Button>
          </>
        }
      >
        <form id="daily-tasks-form" className="space-y-5" onSubmit={submitDaily}>
          {dailyError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {dailyError}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Employee" className="sm:col-span-2">
              <FancySelect
                value={dailyForm.assigneeId}
                onChange={(assigneeId) => setDailyForm((p) => ({ ...p, assigneeId }))}
                options={assigneeOptions}
                placeholder={employees.length ? "Who does the work" : "Add employees first"}
              />
            </SelectField>
            <SelectField label="Supervisor" className="sm:col-span-2">
              <FancySelect
                value={dailyForm.supervisorId}
                onChange={(supervisorId) => setDailyForm((p) => ({ ...p, supervisorId }))}
                options={supervisorOptions}
                placeholder="Who is assigning these tasks"
              />
            </SelectField>
            <Field label="Date">
              <Input
                required
                type="date"
                value={dailyForm.date}
                onChange={(e) => setDailyForm((p) => ({ ...p, date: e.target.value }))}
              />
            </Field>
            <SelectField label={t.common.shift}>
              <FancySelect
                value={dailyForm.shift}
                onChange={(shift) =>
                  setDailyForm((p) => ({ ...p, shift: shift as DutyShift }))
                }
                options={DUTY_SHIFTS.map((s) => ({ value: s, label: s }))}
              />
            </SelectField>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Tasks</p>
            {dailyForm.tasks.map((row, index) => (
              <div
                key={row.key}
                className="grid gap-2 rounded-xl border border-app bg-app p-3 sm:grid-cols-[1fr_9rem_auto]"
              >
                <Field label={index === 0 ? "Task" : ""}>
                  <Input
                    value={row.title}
                    onChange={(e) =>
                      setDailyForm((p) => ({
                        ...p,
                        tasks: p.tasks.map((task) =>
                          task.key === row.key ? { ...task, title: e.target.value } : task,
                        ),
                      }))
                    }
                    placeholder="What they must finish"
                  />
                </Field>
                <SelectField label={index === 0 ? "Area" : ""}>
                  <FancySelect
                    value={row.category}
                    onChange={(category) =>
                      setDailyForm((p) => ({
                        ...p,
                        tasks: p.tasks.map((task) =>
                          task.key === row.key
                            ? { ...task, category: category as DutyCategory }
                            : task,
                        ),
                      }))
                    }
                    options={DUTY_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                </SelectField>
                <div className="flex items-end gap-1">
                  <Field label={index === 0 ? "Pts" : ""} className="w-20">
                    <Input
                      type="number"
                      min={1}
                      value={row.points}
                      onChange={(e) =>
                        setDailyForm((p) => ({
                          ...p,
                          tasks: p.tasks.map((task) =>
                            task.key === row.key ? { ...task, points: e.target.value } : task,
                          ),
                        }))
                      }
                    />
                  </Field>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={dailyForm.tasks.length === 1}
                    icon={<Minus className="h-3.5 w-3.5" />}
                    onClick={() =>
                      setDailyForm((p) => ({
                        ...p,
                        tasks: p.tasks.filter((task) => task.key !== row.key),
                      }))
                    }
                    aria-label="Remove task"
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() =>
                setDailyForm((p) => ({ ...p, tasks: [...p.tasks, emptyDailyRow()] }))
              }
            >
              Add another task
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(signDuty)}
        onClose={() => {
          if (signSaving) return;
          setSignDuty(null);
          setSignAction(null);
          setSignError(null);
        }}
        title={signAction === "complete" ? "Complete task" : "Start task"}
        subtitle="Confirm with the supervising staff member."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={signSaving}
              onClick={() => {
                setSignDuty(null);
                setSignAction(null);
              }}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" form="duty-sign-form" variant="gold" disabled={signSaving}>
              {signSaving
                ? "Saving…"
                : signAction === "complete"
                  ? "Mark complete"
                  : "Start task"}
            </Button>
          </>
        }
      >
        <form id="duty-sign-form" className="space-y-4" onSubmit={submitSign}>
          {signError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {signError}
            </p>
          ) : null}
          <div className="rounded-xl border border-app bg-app px-4 py-3 text-sm">
            <p className="font-semibold">{signDuty?.title}</p>
            <p className="mt-0.5 text-muted">
              {signDuty?.assigneeName || "Unassigned"}
              {signDuty ? ` · ${dutyPoints(signDuty)} pts` : ""}
            </p>
          </div>
          <SelectField label="Supervisor">
            <FancySelect
              value={signSupervisorId}
              onChange={setSignSupervisorId}
              options={supervisorOptions}
              placeholder="Select supervisor"
            />
          </SelectField>
        </form>
      </Modal>

      <Modal
        open={Boolean(editRow)}
        onClose={() => {
          if (editSaving) return;
          setEditRow(null);
        }}
        title="Edit task"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={editSaving}
              onClick={() => setEditRow(null)}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" form="edit-duty-form" disabled={editSaving}>
              {editSaving ? "Saving…" : t.common.save}
            </Button>
          </>
        }
      >
        <form id="edit-duty-form" className="space-y-4" onSubmit={submitEdit}>
          <Field label="Task">
            <Input
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </Field>
          <SelectField label="Status">
            <FancySelect
              value={editStatus}
              onChange={(v) => setEditStatus(v as DutyStatus)}
              options={DUTY_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </SelectField>
        </form>
      </Modal>

      <Modal
        open={Boolean(missRow)}
        onClose={() => {
          if (missing) return;
          setMissRow(null);
        }}
        title="Mark task missed"
        subtitle={
          missRow
            ? `${missRow.assigneeName || "This employee"} will lose ${dutyPoints(missRow)} points.`
            : undefined
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={missing}
              onClick={() => setMissRow(null)}
            >
              {t.common.cancel}
            </Button>
            <Button type="button" variant="danger" disabled={missing} onClick={confirmMissed}>
              {missing ? "Saving…" : "Deduct points"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Use when the task was not done. Overdue open tasks also deduct the next day.
        </p>
      </Modal>

      <Modal
        open={Boolean(deleteRow)}
        onClose={() => {
          if (deleting) return;
          setDeleteRow(null);
        }}
        title="Delete task"
        subtitle={
          deleteRow ? `Remove “${deleteRow.title}” from the roster?` : undefined
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={deleting}
              onClick={() => setDeleteRow(null)}
            >
              {t.common.cancel}
            </Button>
            <Button type="button" variant="danger" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">This cannot be undone.</p>
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-app px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-semibold break-words">{value}</p>
    </div>
  );
}
