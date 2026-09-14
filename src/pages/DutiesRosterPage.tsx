import {
  Check,
  Eye,
  Minus,
  Pencil,
  Play,
  Plus,
  Trash2,
  UserPlus,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, StatCard, TextArea } from "../components/ui/Page";
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
  createDuty,
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

function emptyForm() {
  return {
    title: "",
    category: "Front desk" as DutyCategory,
    description: "",
    date: todayIsoDate(),
    shift: "Morning" as DutyShift,
    status: "scheduled" as DutyStatus,
    points: String(DEFAULT_DUTY_POINTS),
    assigneeId: "",
    checkedInById: "",
    checkedOutById: "",
    notes: "",
  };
}

function emptyDailyRow() {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    points: String(DEFAULT_DUTY_POINTS),
    category: "Other" as DutyCategory,
  };
}

function employeeSelectOptions(
  employees: Employee[],
  extraId?: string | null,
  extraName?: string | null,
  emptyLabel = "Unassigned",
) {
  const active = employees.filter((e) => e.status === "active");
  const list = [...active];
  if (extraId && !list.some((e) => e.id === extraId)) {
    const found = employees.find((e) => e.id === extraId);
    list.unshift(
      found ?? {
        id: extraId,
        name: extraName || "Former staff",
        phone: "",
        email: "",
        designation: "",
        shift: "Morning",
        status: "inactive",
        address: "",
        backgroundInformation: "",
        notes: "",
        cnicFrontImageUrl: null,
        cnicBackImageUrl: null,
      },
    );
  }
  return [
    { value: "", label: emptyLabel },
    ...list.map((e) => ({
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
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | DutyStatus>("open");
  const [dateFilter, setDateFilter] = useState<"today" | "upcoming" | "all">("today");
  const [dailyDate, setDailyDate] = useState(todayIsoDate);
  const [scorePeriod, setScorePeriod] = useState<ScorePeriod>("week");

  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [dailyOpen, setDailyOpen] = useState(false);
  const [dailySaving, setDailySaving] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailyForm, setDailyForm] = useState({
    date: todayIsoDate(),
    shift: "Morning" as DutyShift,
    assigneeId: "",
    checkedInById: "",
    tasks: [emptyDailyRow()],
  });

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
    return () => {
      a();
      b();
    };
  }, []);

  const today = todayIsoDate();

  const filtered = useMemo(() => {
    return duties.filter((row) => {
      if (statusFilter === "open") {
        if (row.status === "completed" || row.status === "cancelled" || row.status === "missed") {
          return false;
        }
      } else if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }
      if (dateFilter === "today" && row.date !== today) return false;
      if (dateFilter === "upcoming" && row.date < today) return false;
      return true;
    });
  }, [duties, statusFilter, dateFilter, today]);

  const dailyDuties = useMemo(
    () => duties.filter((d) => d.date === dailyDate && d.status !== "cancelled"),
    [duties, dailyDate],
  );

  const dailyGroups = useMemo(() => {
    const byId = new Map<string, { employee: Employee | null; name: string; rows: DutyAssignment[] }>();
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
        rows: [row],
      });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [dailyDuties, employees]);

  const scoredDuties = useMemo(
    () => dutiesInPeriod(duties, scorePeriod, today),
    [duties, scorePeriod, today],
  );

  const performance = useMemo(() => {
    const active = employees.filter((e) => e.status === "active");
    return active
      .map((e) => scoreEmployeeDuties(scoredDuties, e, today))
      .sort((a, b) => b.score - a.score || b.earnedPoints - a.earnedPoints);
  }, [employees, scoredDuties, today]);

  const stats = useMemo(() => {
    const todays = duties.filter((d) => d.date === today);
    const scoredToday = todays.filter((d) => d.status !== "cancelled" && d.assigneeId);
    const completedToday = scoredToday.filter((d) => d.status === "completed");
    return {
      today: todays.length,
      inProgress: duties.filter((d) => d.status === "in_progress").length,
      completedToday: completedToday.length,
      missed: duties.filter((d) => d.status === "missed" || (d.date < today && d.status !== "completed" && d.status !== "cancelled" && d.assigneeId)).length,
    };
  }, [duties, today]);

  function findSelf() {
    return employees.find(
      (e) =>
        e.status === "active" &&
        (e.name.toLowerCase() === staffDisplayName.toLowerCase() ||
          (e.email && user?.email && e.email.toLowerCase() === user.email.toLowerCase())),
    );
  }

  function closeForm() {
    if (saving) return;
    setMode(null);
    setEditingId(null);
    setFormError(null);
  }

  function openCreate() {
    const self = findSelf();
    setForm({
      ...emptyForm(),
      checkedInById: self?.id || "",
    });
    setEditingId(null);
    setFormError(null);
    setMode("create");
  }

  function openDailyCreate(assigneeId = "") {
    const self = findSelf();
    setDailyForm({
      date: dailyDate || todayIsoDate(),
      shift: "Morning",
      assigneeId,
      checkedInById: self?.id || "",
      tasks: [emptyDailyRow()],
    });
    setDailyError(null);
    setDailyOpen(true);
  }

  function openEdit(row: DutyAssignment) {
    setForm({
      title: row.title,
      category: row.category,
      description: row.description,
      date: row.date || todayIsoDate(),
      shift: row.shift,
      status: row.status,
      points: String(dutyPoints(row)),
      assigneeId: row.assigneeId || "",
      checkedInById: row.checkedInById || "",
      checkedOutById: row.checkedOutById || "",
      notes: row.notes,
    });
    setEditingId(row.id);
    setFormError(null);
    setMode("edit");
  }

  function buildPayload() {
    const assignee = employees.find((e) => e.id === form.assigneeId);
    const inBy = employees.find((e) => e.id === form.checkedInById);
    const outBy = employees.find((e) => e.id === form.checkedOutById);
    return {
      title: form.title.trim(),
      category: form.category,
      description: form.description,
      date: form.date,
      shift: form.shift,
      status: form.status,
      points: Number(form.points) || DEFAULT_DUTY_POINTS,
      assigneeId: form.assigneeId || null,
      assigneeName: assignee?.name || null,
      checkedInById: form.checkedInById || null,
      checkedInBy: inBy?.name || "",
      checkedOutById: form.checkedOutById || null,
      checkedOutBy: outBy?.name || "",
      notes: form.notes,
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError("Duty / task title is required.");
      return;
    }
    if (!form.date) {
      setFormError("Date is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = buildPayload();
      if (mode === "edit" && editingId) {
        await updateDuty(editingId, payload);
        toastSuccess("Duty updated", payload.title);
      } else {
        await createDuty(payload);
        toastSuccess("Duty added", payload.title);
      }
      setMode(null);
      setEditingId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save duty.";
      setFormError(message);
      toastError("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  async function submitDaily(e: React.FormEvent) {
    e.preventDefault();
    const assignee = employees.find((emp) => emp.id === dailyForm.assigneeId);
    if (!assignee) {
      setDailyError("Select the employee these tasks belong to.");
      return;
    }
    const tasks = dailyForm.tasks.filter((row) => row.title.trim());
    if (!tasks.length) {
      setDailyError("Add at least one task title.");
      return;
    }
    if (!dailyForm.date) {
      setDailyError("Date is required.");
      return;
    }
    const inBy = employees.find((emp) => emp.id === dailyForm.checkedInById);
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
          checkedInById: inBy?.id || null,
          checkedInBy: inBy?.name || "",
          checkedOutById: null,
          checkedOutBy: "",
          notes: "",
        })),
      );
      toastSuccess(
        "Daily tasks added",
        `${tasks.length} task${tasks.length === 1 ? "" : "s"} for ${assignee.name}`,
      );
      setDailyOpen(false);
      setDailyDate(dailyForm.date);
      setTab("daily");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add daily tasks.";
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
    setSignSupervisorId(
      action === "start"
        ? row.checkedInById || self?.id || ""
        : row.checkedOutById || self?.id || "",
    );
    setSignError(null);
  }

  async function submitSign(e: React.FormEvent) {
    e.preventDefault();
    if (!signDuty || !signAction) return;
    if (!signDuty.assigneeId) {
      setSignError("Assign an employee before starting this duty.");
      return;
    }
    const supervisor = employees.find((emp) => emp.id === signSupervisorId);
    if (!supervisor) {
      setSignError(
        signAction === "start"
          ? "Select who is checking this duty in."
          : "Select who is checking this duty out.",
      );
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
        toastSuccess("Duty started", `${signDuty.title} · in by ${supervisor.name}`);
      } else {
        await updateDuty(
          signDuty.id,
          dutyToInput(signDuty, {
            status: "completed",
            checkedOutById: supervisor.id,
            checkedOutBy: supervisor.name,
          }),
        );
        toastSuccess(
          "Task completed",
          `${signDuty.title} · +${dutyPoints(signDuty)} pts`,
        );
      }
      setSignDuty(null);
      setSignAction(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update duty.";
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
      toastSuccess(
        "Marked missed",
        `${missRow.title} · −${dutyPoints(missRow)} pts`,
      );
      setMissRow(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not mark missed.";
      toastError("Update failed", message);
    } finally {
      setMissing(false);
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await deleteDuty(deleteRow.id);
      toastSuccess("Duty removed", deleteRow.title);
      setDeleteRow(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete duty.";
      toastError("Delete failed", message);
    } finally {
      setDeleting(false);
    }
  }

  const assigneeOptions = employeeSelectOptions(employees);
  const supervisorOptions = employeeSelectOptions(
    employees,
    null,
    null,
    "Select supervisor",
  );

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
          <>
            <Button
              type="button"
              variant="secondary"
              className="w-full shrink-0 cursor-pointer sm:w-auto"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => openDailyCreate()}
            >
              Add daily tasks
            </Button>
            <Button
              type="button"
              className="w-full shrink-0 cursor-pointer sm:w-auto"
              icon={<Plus className="h-4 w-4" />}
              onClick={openCreate}
            >
              Add duty
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today" value={String(stats.today)} hint="Tasks on the roster today" />
        <StatCard label="In progress" value={String(stats.inProgress)} hint="Currently on duty" />
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
            <p className="pb-2 text-sm text-muted">
              {dailyDuties.length} task{dailyDuties.length === 1 ? "" : "s"} · {formatDutyDate(dailyDate)}
            </p>
          </div>
          {dailyGroups.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">
                No tasks for this day. Add daily tasks and assign them to an employee.
              </p>
            </Card>
          ) : (
            dailyGroups.map((group) => {
              const score = group.employee
                ? scoreEmployeeDuties(
                    duties.filter((d) => d.date === dailyDate),
                    group.employee,
                    today,
                  )
                : null;
              const open = group.rows.filter(
                (r) => r.status === "scheduled" || r.status === "in_progress",
              );
              return (
                <Card key={group.employee?.id || group.name}>
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
                    {group.rows.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-col gap-2 rounded-xl border border-app bg-app px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{row.title}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            {row.category} · {row.shift} · {dutyPoints(row)} pts
                            {row.checkedInBy ? ` · in by ${row.checkedInBy}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>
                          {row.status === "scheduled" ? (
                            <Button
                              size="sm"
                              variant="gold"
                              icon={<Play className="h-3.5 w-3.5" />}
                              onClick={() => openSign(row, "start")}
                            >
                              Start
                            </Button>
                          ) : null}
                          {row.status === "in_progress" ? (
                            <Button
                              size="sm"
                              variant="gold"
                              icon={<Check className="h-3.5 w-3.5" />}
                              onClick={() => openSign(row, "complete")}
                            >
                              Done
                            </Button>
                          ) : null}
                          {open.includes(row) ? (
                            <Button
                              size="sm"
                              variant="danger"
                              icon={<XCircle className="h-3.5 w-3.5" />}
                              onClick={() => setMissRow(row)}
                            >
                              Missed
                            </Button>
                          ) : null}
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
          <div className="mb-4 w-full sm:w-44">
            <FancySelect
              value={scorePeriod}
              onChange={(v) => setScorePeriod(v as ScorePeriod)}
              options={[
                { value: "today", label: "Today" },
                { value: "week", label: "This week" },
                { value: "all", label: "All time" },
              ]}
            />
          </div>
          <Card>
            <Table
              headers={[
                "Employee",
                "Done / assigned",
                "Earned",
                "Deducted",
                "Score",
              ]}
              colWidths={["28%", "18%", "16%", "16%", "22%"]}
            >
              {performance.length === 0 ? (
                <Tr>
                  <Td className="text-muted" colSpan={5}>
                    Add employees to track daily task scores.
                  </Td>
                </Tr>
              ) : (
                performance.map((row) => (
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
                      <div className="space-y-1.5">
                        <Badge tone={scoreTone(row.score, row.hasScoredTasks)}>
                          {row.hasScoredTasks ? `${row.score}% · ${row.label}` : row.label}
                        </Badge>
                        <div className="h-1.5 overflow-hidden rounded-full bg-app">
                          <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${row.hasScoredTasks ? row.score : 0}%` }}
                          />
                        </div>
                      </div>
                    </Td>
                  </Tr>
                ))
              )}
            </Table>
          </Card>
          <p className="mt-3 text-xs text-muted">
            Completed tasks add points. Missed or overdue tasks deduct the same points from the
            score. Today’s unfinished tasks stay pending until they are done or marked missed.
          </p>
        </div>
      ) : null}

      {tab === "roster" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="min-w-[8.5rem] flex-1 sm:w-36 sm:flex-none">
              <FancySelect
                value={dateFilter}
                onChange={(v) => setDateFilter(v as typeof dateFilter)}
                options={[
                  { value: "today", label: "Today" },
                  { value: "upcoming", label: "Upcoming" },
                  { value: "all", label: "All dates" },
                ]}
              />
            </div>
            <div className="min-w-[8.5rem] flex-1 sm:w-36 sm:flex-none">
              <FancySelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { value: "open", label: "Open" },
                  { value: "all", label: "All status" },
                  ...DUTY_STATUSES.map((s) => ({ value: s.value, label: s.label })),
                ]}
              />
            </div>
          </div>
          <Card>
            <Table
              headers={[
                "Duty",
                "Assigned to",
                "Pts",
                "Checked in by",
                "Checked out by",
                t.status,
                t.common.actions,
              ]}
              colWidths={["18%", "13%", "7%", "13%", "13%", "11%", "25%"]}
            >
              {filtered.length === 0 ? (
                <Tr>
                  <Td className="text-muted" colSpan={7}>
                    No duties yet. Add a task and assign it to an employee.
                  </Td>
                </Tr>
              ) : (
                filtered.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <p className="font-semibold">{row.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {row.category} · {formatDutyDate(row.date)} · {row.shift}
                      </p>
                    </Td>
                    <Td>
                      {row.assigneeName ? (
                        <span className="font-semibold">{row.assigneeName}</span>
                      ) : (
                        <span className="text-muted">Unassigned</span>
                      )}
                    </Td>
                    <Td>{dutyPoints(row)}</Td>
                    <Td className="text-muted">{row.checkedInBy || "—"}</Td>
                    <Td className="text-muted">{row.checkedOutBy || "—"}</Td>
                    <Td>
                      <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500"
                          icon={<Eye className="h-3.5 w-3.5" />}
                          onClick={() => setViewRow(row)}
                        >
                          View
                        </Button>
                        {row.status === "scheduled" && row.assigneeId ? (
                          <Button
                            size="sm"
                            variant="gold"
                            className="cursor-pointer"
                            icon={<Play className="h-3.5 w-3.5" />}
                            onClick={() => openSign(row, "start")}
                          >
                            Start
                          </Button>
                        ) : null}
                        {row.status === "scheduled" && !row.assigneeId ? (
                          <Button
                            size="sm"
                            variant="gold"
                            className="cursor-pointer"
                            icon={<UserPlus className="h-3.5 w-3.5" />}
                            onClick={() => openEdit(row)}
                          >
                            Assign
                          </Button>
                        ) : null}
                        {row.status === "in_progress" ? (
                          <Button
                            size="sm"
                            variant="gold"
                            className="cursor-pointer"
                            icon={<Check className="h-3.5 w-3.5" />}
                            onClick={() => openSign(row, "complete")}
                          >
                            Complete
                          </Button>
                        ) : null}
                        {row.status === "scheduled" || row.status === "in_progress" ? (
                          <Button
                            size="sm"
                            variant="danger"
                            className="cursor-pointer"
                            icon={<XCircle className="h-3.5 w-3.5" />}
                            onClick={() => setMissRow(row)}
                          >
                            Missed
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="cursor-pointer"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => openEdit(row)}
                        >
                          {t.common.edit}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          className="cursor-pointer"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => setDeleteRow(row)}
                        >
                          {t.common.delete}
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))
              )}
            </Table>
          </Card>
        </>
      ) : null}

      <Modal
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title={viewRow?.title ?? "Duty"}
        subtitle={viewRow ? `${viewRow.category} · ${formatDutyDate(viewRow.date)}` : undefined}
        wide
        footer={
          <Button type="button" variant="secondary" onClick={() => setViewRow(null)}>
            Close
          </Button>
        }
      >
        {viewRow ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="gold">{viewRow.shift}</Badge>
              <Badge tone={statusTone[viewRow.status]}>{statusLabel[viewRow.status]}</Badge>
              <Badge tone="gold">{dutyPoints(viewRow)} pts</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Assigned to" value={viewRow.assigneeName || "Unassigned"} />
              <Detail label="Category" value={viewRow.category} />
              <Detail label="Checked in by" value={viewRow.checkedInBy || "—"} />
              <Detail label="Checked out by" value={viewRow.checkedOutBy || "—"} />
            </div>
            {viewRow.description ? (
              <section className="rounded-2xl border border-app bg-app px-4 py-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                  Duty details
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{viewRow.description}</p>
              </section>
            ) : null}
            {viewRow.notes ? (
              <p className="rounded-xl bg-app px-3 py-2 text-sm text-muted">{viewRow.notes}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={mode != null}
        onClose={closeForm}
        title={mode === "edit" ? "Edit duty" : "Add duty"}
        subtitle="Assign a task to staff. Completed tasks earn points; missed tasks deduct them."
        wide
        footer={
          <>
            <Button type="button" variant="secondary" disabled={saving} onClick={closeForm}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="duty-form" disabled={saving}>
              {saving ? "Saving…" : t.common.save}
            </Button>
          </>
        }
      >
        <form id="duty-form" className="space-y-5" onSubmit={submit}>
          {formError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duty / task" className="sm:col-span-2">
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Night security, Lobby reception, Kitchen prep"
              />
            </Field>
            <SelectField label="Category">
              <FancySelect
                value={form.category}
                onChange={(category) =>
                  setForm((p) => ({ ...p, category: category as DutyCategory }))
                }
                options={DUTY_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </SelectField>
            <SelectField label={t.status}>
              <FancySelect
                value={form.status}
                onChange={(status) => setForm((p) => ({ ...p, status: status as DutyStatus }))}
                options={DUTY_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
              />
            </SelectField>
            <Field label="Date">
              <Input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </Field>
            <SelectField label={t.common.shift}>
              <FancySelect
                value={form.shift}
                onChange={(shift) => setForm((p) => ({ ...p, shift: shift as DutyShift }))}
                options={DUTY_SHIFTS.map((s) => ({ value: s, label: s }))}
              />
            </SelectField>
            <Field label="Points">
              <Input
                required
                type="number"
                min={1}
                value={form.points}
                onChange={(e) => setForm((p) => ({ ...p, points: e.target.value }))}
              />
            </Field>
          </div>

          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
              <UserRound className="h-3.5 w-3.5" />
              Assignment & supervisors
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Assign to" className="sm:col-span-2">
                <FancySelect
                  value={form.assigneeId}
                  onChange={(assigneeId) => setForm((p) => ({ ...p, assigneeId }))}
                  options={assigneeOptions}
                  placeholder={
                    employees.length ? "Select employee" : "Add employees first"
                  }
                />
              </SelectField>
              <SelectField label="Checked in by">
                <FancySelect
                  value={form.checkedInById}
                  onChange={(checkedInById) => setForm((p) => ({ ...p, checkedInById }))}
                  options={supervisorOptions}
                  placeholder="Supervisor who starts the duty"
                />
              </SelectField>
              <SelectField label="Checked out by">
                <FancySelect
                  value={form.checkedOutById}
                  onChange={(checkedOutById) => setForm((p) => ({ ...p, checkedOutById }))}
                  options={supervisorOptions}
                  placeholder="Supervisor who signs off"
                />
              </SelectField>
            </div>
          </div>

          <Field label="Duty details">
            <TextArea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="What this duty covers, area, or instructions"
            />
          </Field>
          <Field label={t.common.notes}>
            <TextArea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={dailyOpen}
        onClose={() => {
          if (dailySaving) return;
          setDailyOpen(false);
        }}
        title="Add daily tasks"
        subtitle="Give one employee several tasks for a day. Each completed task earns points; missed tasks deduct them."
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
              {dailySaving ? "Saving…" : "Save tasks"}
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
                placeholder={employees.length ? "Who must do these tasks" : "Add employees first"}
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
            <SelectField label="Checked in by" className="sm:col-span-2">
              <FancySelect
                value={dailyForm.checkedInById}
                onChange={(checkedInById) => setDailyForm((p) => ({ ...p, checkedInById }))}
                options={supervisorOptions}
                placeholder="Supervisor"
              />
            </SelectField>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Tasks for this day</p>
            {dailyForm.tasks.map((row, index) => (
              <div key={row.key} className="grid gap-2 rounded-xl border border-app bg-app p-3 sm:grid-cols-[1fr_9rem_7rem_auto]">
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
                <SelectField label={index === 0 ? "Category" : ""}>
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
                <Field label={index === 0 ? "Pts" : ""}>
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
                <div className={cn("flex items-end", index === 0 && "sm:pb-0")}>
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
                  >
                    Remove
                  </Button>
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
        title={signAction === "complete" ? "Complete duty" : "Start duty"}
        subtitle={
          signAction === "complete"
            ? `Who is checking out ${signDuty?.assigneeName || "this staff member"}?`
            : `Who is checking in ${signDuty?.assigneeName || "this staff member"}?`
        }
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
                  ? "Check out & complete"
                  : "Check in & start"}
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
              {signDuty?.assigneeName || "Unassigned"} · {signDuty?.shift}
              {signDuty ? ` · ${dutyPoints(signDuty)} pts` : ""}
            </p>
          </div>
          <SelectField
            label={signAction === "complete" ? "Checked out by" : "Checked in by"}
          >
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
          Use this when the task was not done. Overdue open tasks also deduct automatically the
          next day.
        </p>
      </Modal>

      <Modal
        open={Boolean(deleteRow)}
        onClose={() => {
          if (deleting) return;
          setDeleteRow(null);
        }}
        title="Delete duty"
        subtitle={
          deleteRow
            ? `Remove “${deleteRow.title}” from the roster? This cannot be undone.`
            : undefined
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
        <p className="text-sm text-muted">
          Assigned staff and supervisor records for this duty will be removed.
        </p>
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
