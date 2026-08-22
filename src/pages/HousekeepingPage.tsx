import { Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, StatCard, TextArea } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { subscribeEmployees, type Employee } from "../services/employees";
import {
  createHousekeepingTask,
  subscribeHousekeepingTasks,
  updateHousekeepingTask,
  type HousekeepingPriority,
  type HousekeepingTask,
  type HousekeepingTaskStatus,
  type HousekeepingTaskType,
} from "../services/housekeeping";
import { subscribeRooms, type HotelRoom } from "../services/rooms";
import { HOUSEKEEPING_TASK_TYPES } from "../types/housekeeping";

const priorityTone: Record<HousekeepingPriority, "danger" | "gold" | "muted"> = {
  high: "danger",
  normal: "gold",
  low: "muted",
};

const statusTone: Record<HousekeepingTaskStatus, "warning" | "info" | "success"> = {
  pending: "warning",
  in_progress: "info",
  done: "success",
};

const typeLabel = Object.fromEntries(
  HOUSEKEEPING_TASK_TYPES.map((t) => [t.value, t.label]),
) as Record<HousekeepingTaskType, string>;

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isoToLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return toLocalInputValue(new Date());
  return toLocalInputValue(d);
}

function formatDue(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const emptyForm = () => ({
  roomId: "",
  type: "checkout_clean" as HousekeepingTaskType,
  priority: "normal" as HousekeepingPriority,
  status: "pending" as HousekeepingTaskStatus,
  assigneeId: "",
  dueAt: toLocalInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)),
  notes: "",
});

export function HousekeepingPage() {
  const { t } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();

  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState<"open" | "all" | HousekeepingTaskStatus>("all");
  const [roomCleanFilter, setRoomCleanFilter] = useState<
    "all" | "clean" | "dirty" | "cleaning_in_progress"
  >("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const a = subscribeHousekeepingTasks(setTasks);
    const b = subscribeRooms(setRooms);
    const c = subscribeEmployees(setEmployees);
    return () => {
      a();
      b();
      c();
    };
  }, []);

  const housekeepers = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.status === "active" &&
          (e.department === "Housekeeping" ||
            e.jobTitle.toLowerCase().includes("clean") ||
            e.jobTitle.toLowerCase().includes("housekeep")),
      ),
    [employees],
  );

  const assigneeOptions = useMemo(() => {
    const list = housekeepers.length
      ? housekeepers
      : employees.filter((e) => e.status === "active");
    return list;
  }, [housekeepers, employees]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return tasks;
    if (statusFilter === "open") return tasks.filter((t) => t.status !== "done");
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const stats = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const unassigned = tasks.filter((t) => t.status !== "done" && !t.assigneeId).length;
    const dirtyRooms = rooms.filter((r) => r.cleaningStatus === "dirty").length;
    const cleanRooms = rooms.filter((r) => r.cleaningStatus === "clean").length;
    return { open, inProgress, unassigned, dirtyRooms, cleanRooms };
  }, [tasks, rooms]);

  const filteredRooms = useMemo(() => {
    if (roomCleanFilter === "all") return rooms;
    return rooms.filter((r) => r.cleaningStatus === roomCleanFilter);
  }, [rooms, roomCleanFilter]);

  const cleaningLabel: Record<string, string> = {
    clean: "Clean",
    dirty: "Dirty",
    cleaning_in_progress: "Cleaning in progress",
  };

  const cleaningTone: Record<string, "success" | "warning" | "info"> = {
    clean: "success",
    dirty: "warning",
    cleaning_in_progress: "info",
  };

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(task: HousekeepingTask) {
    setEditingId(task.id);
    setForm({
      roomId: task.roomId,
      type: task.type,
      priority: task.priority,
      status: task.status,
      assigneeId: task.assigneeId || "",
      dueAt: isoToLocalInput(task.dueAt),
      notes: task.notes || "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const room = rooms.find((r) => r.id === form.roomId);
    if (!room) {
      setFormError("Select a room.");
      return;
    }
    if (!form.dueAt) {
      setFormError("Due date & time is required.");
      return;
    }
    const assignee = assigneeOptions.find((a) => a.id === form.assigneeId) ?? null;
    const dueAt = new Date(form.dueAt).toISOString();

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        roomId: room.id,
        roomNumber: room.number,
        type: form.type,
        priority: form.priority,
        status: form.status,
        assigneeId: assignee?.id ?? null,
        assigneeName: assignee?.name ?? null,
        dueAt,
        notes: form.notes,
      };
      if (editingId) {
        await updateHousekeepingTask(editingId, payload);
        toastSuccess("Task updated", `Room ${room.number}`);
      } else {
        await createHousekeepingTask(payload);
        toastSuccess("Task created", `Room ${room.number}`);
      }
      setModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save task.";
      setFormError(message);
      toastError("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.housekeepingTitle}
        subtitle="Assign cleaning tasks to employees — room status updates when work starts or finishes."
        actions={
          <>
            <div className="w-40 shrink-0">
              <FancySelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { value: "all", label: "All" },
                  { value: "open", label: "Open tasks" },
                  { value: "pending", label: "Pending" },
                  { value: "in_progress", label: "In progress" },
                  { value: "done", label: "Done" },
                ]}
              />
            </div>
            <Button
              type="button"
              className="shrink-0 cursor-pointer"
              icon={<Plus className="h-4 w-4" />}
              onClick={openCreate}
            >
              Add task
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tasks" value={String(stats.open)} />
        <StatCard label="In progress" value={String(stats.inProgress)} />
        <StatCard label="Dirty rooms" value={String(stats.dirtyRooms)} hint="Need cleaning" />
        <StatCard label="Clean rooms" value={String(stats.cleanRooms)} />
      </div>

      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">Rooms by cleaning status</p>
            <p className="text-xs text-muted">
              After checkout a room turns dirty here until housekeeping finishes.
            </p>
          </div>
          <div className="w-48 shrink-0">
            <FancySelect
              value={roomCleanFilter}
              onChange={(v) => setRoomCleanFilter(v as typeof roomCleanFilter)}
              options={[
                { value: "all", label: "All rooms" },
                { value: "dirty", label: "Dirty" },
                { value: "clean", label: "Clean" },
                { value: "cleaning_in_progress", label: "Cleaning in progress" },
              ]}
            />
          </div>
        </div>
        {filteredRooms.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No rooms match this filter.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-app bg-app px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-bold">
                    {t.common.room} {room.number}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {room.guest?.name
                      ? `Guest · ${room.guest.name}`
                      : room.status === "available"
                        ? "Not booked"
                        : room.status}
                  </p>
                </div>
                <Badge tone={cleaningTone[room.cleaningStatus] ?? "muted"}>
                  {cleaningLabel[room.cleaningStatus] ?? room.cleaningStatus}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">Cleaning tasks</p>
        </div>
        <Table
          headers={[
            t.common.room,
            t.common.type,
            "Priority",
            "Assignee",
            "Due",
            t.status,
            t.common.actions,
          ]}
          colWidths={["10%", "16%", "12%", "18%", "16%", "14%", "14%"]}
        >
          {filtered.length === 0 ? (
            <Tr>
              <Td className="text-muted" colSpan={7}>
                No housekeeping tasks yet. Add a task and assign it to an employee.
              </Td>
            </Tr>
          ) : (
            filtered.map((task) => (
              <Tr key={task.id}>
                <Td className="font-bold">
                  {t.common.room} {task.roomNumber}
                </Td>
                <Td>{typeLabel[task.type]}</Td>
                <Td>
                  <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
                </Td>
                <Td>
                  {task.assigneeName ? (
                    task.assigneeName
                  ) : (
                    <span className="text-muted">Unassigned</span>
                  )}
                </Td>
                <Td className="text-muted">{formatDue(task.dueAt)}</Td>
                <Td>
                  <Badge tone={statusTone[task.status]}>
                    {task.status.replace("_", " ")}
                  </Badge>
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant="gold"
                    className="cursor-pointer"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => openEdit(task)}
                  >
                    Update
                  </Button>
                </Td>
              </Tr>
            ))
          )}
        </Table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? "Update task" : "Add housekeeping task"}
        subtitle="Pick a room and assign an employee. Starting or finishing updates room cleaning status."
        wide
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" form="hk-task-form" disabled={saving}>
              {saving ? "Saving…" : t.common.save}
            </Button>
          </>
        }
      >
        <form id="hk-task-form" className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          {formError ? (
            <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}

          <SelectField label={t.common.room}>
            <FancySelect
              value={form.roomId}
              onChange={(roomId) => setForm((p) => ({ ...p, roomId }))}
              placeholder={rooms.length ? "Select room" : "No rooms yet"}
              options={rooms.map((r) => ({
                value: r.id,
                label: `Room ${r.number} · ${r.cleaningStatus.replace(/_/g, " ")}`,
              }))}
            />
          </SelectField>

          <SelectField label={t.common.type}>
            <FancySelect
              value={form.type}
              onChange={(type) => setForm((p) => ({ ...p, type: type as HousekeepingTaskType }))}
              options={HOUSEKEEPING_TASK_TYPES.map((x) => ({
                value: x.value,
                label: x.label,
              }))}
            />
          </SelectField>

          <SelectField label="Priority">
            <FancySelect
              value={form.priority}
              onChange={(priority) =>
                setForm((p) => ({ ...p, priority: priority as HousekeepingPriority }))
              }
              options={[
                { value: "high", label: "High" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low" },
              ]}
            />
          </SelectField>

          <SelectField label="Assignee">
            <FancySelect
              value={form.assigneeId}
              onChange={(assigneeId) => setForm((p) => ({ ...p, assigneeId }))}
              placeholder={
                assigneeOptions.length
                  ? "Unassigned (optional)"
                  : "Add employees first"
              }
              options={[
                { value: "", label: "Unassigned" },
                ...assigneeOptions.map((e) => ({
                  value: e.id,
                  label: `${e.name} · ${e.shift}`,
                })),
              ]}
            />
          </SelectField>

          <SelectField label={t.status}>
            <FancySelect
              value={form.status}
              onChange={(status) =>
                setForm((p) => ({ ...p, status: status as HousekeepingTaskStatus }))
              }
              options={[
                { value: "pending", label: "Pending" },
                { value: "in_progress", label: "In progress" },
                { value: "done", label: "Done" },
              ]}
            />
          </SelectField>

          <Field label="Due (date & time)">
            <Input
              required
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))}
            />
          </Field>

          <Field label={t.common.notes} className="sm:col-span-2">
            <TextArea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Extra towels, VIP room…"
              rows={2}
            />
          </Field>

          {!assigneeOptions.length ? (
            <p className="sm:col-span-2 text-sm text-muted">
              Tip: add active staff under Employees (Housekeeping department) so you can assign tasks.
            </p>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
