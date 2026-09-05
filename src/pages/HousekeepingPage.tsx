import { Check, ImagePlus, Pencil, Plus, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, StatCard, TextArea } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { uploadImageToCloudinary } from "../lib/cloudinary";
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

/** Plain-language labels for staff who are not tech-heavy. */
const statusLabel: Record<HousekeepingTaskStatus, string> = {
  pending: "Needs cleaning",
  in_progress: "Cleaning now",
  done: "Done",
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
  const dirtyPhotoRef = useRef<HTMLInputElement>(null);
  const cleanPhotoRef = useRef<HTMLInputElement>(null);

  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState<"open" | "all" | HousekeepingTaskStatus>("open");
  const [roomCleanFilter, setRoomCleanFilter] = useState<
    "all" | "clean" | "dirty" | "cleaning_in_progress"
  >("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [assignTask, setAssignTask] = useState<HousekeepingTask | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [dirtyPhotoFile, setDirtyPhotoFile] = useState<File | null>(null);
  const [dirtyPhotoPreview, setDirtyPhotoPreview] = useState<string | null>(null);

  const [doneTask, setDoneTask] = useState<HousekeepingTask | null>(null);
  const [doneSaving, setDoneSaving] = useState(false);
  const [doneError, setDoneError] = useState<string | null>(null);
  const [cleanPhotoFile, setCleanPhotoFile] = useState<File | null>(null);
  const [cleanPhotoPreview, setCleanPhotoPreview] = useState<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (dirtyPhotoPreview) URL.revokeObjectURL(dirtyPhotoPreview);
      if (cleanPhotoPreview) URL.revokeObjectURL(cleanPhotoPreview);
    };
  }, [dirtyPhotoPreview, cleanPhotoPreview]);

  const housekeepers = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.status === "active" &&
          (e.designation.toLowerCase().includes("clean") ||
            e.designation.toLowerCase().includes("housekeep") ||
            e.designation.toLowerCase().includes("attendant") ||
            e.designation.toLowerCase().includes("room")),
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
    if (statusFilter === "open") return tasks.filter((task) => task.status !== "done");
    return tasks.filter((task) => task.status === statusFilter);
  }, [tasks, statusFilter]);

  const stats = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "done").length;
    const inProgress = tasks.filter((task) => task.status === "in_progress").length;
    const dirtyRooms = rooms.filter((r) => r.cleaningStatus === "dirty").length;
    const cleanRooms = rooms.filter((r) => r.cleaningStatus === "clean").length;
    return { open, inProgress, dirtyRooms, cleanRooms };
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

  function clearDirtyPhoto() {
    if (dirtyPhotoPreview) URL.revokeObjectURL(dirtyPhotoPreview);
    setDirtyPhotoFile(null);
    setDirtyPhotoPreview(null);
    if (dirtyPhotoRef.current) dirtyPhotoRef.current.value = "";
  }

  function clearCleanPhoto() {
    if (cleanPhotoPreview) URL.revokeObjectURL(cleanPhotoPreview);
    setCleanPhotoFile(null);
    setCleanPhotoPreview(null);
    if (cleanPhotoRef.current) cleanPhotoRef.current.value = "";
  }

  function onPickDirtyPhoto(file: File | null) {
    if (dirtyPhotoPreview) URL.revokeObjectURL(dirtyPhotoPreview);
    if (!file) {
      setDirtyPhotoFile(null);
      setDirtyPhotoPreview(null);
      return;
    }
    setDirtyPhotoFile(file);
    setDirtyPhotoPreview(URL.createObjectURL(file));
  }

  function onPickCleanPhoto(file: File | null) {
    if (cleanPhotoPreview) URL.revokeObjectURL(cleanPhotoPreview);
    if (!file) {
      setCleanPhotoFile(null);
      setCleanPhotoPreview(null);
      return;
    }
    setCleanPhotoFile(file);
    setCleanPhotoPreview(URL.createObjectURL(file));
  }

  function openAssign(task: HousekeepingTask) {
    clearDirtyPhoto();
    setAssignTask(task);
    setAssignEmployeeId(task.assigneeId || "");
    setAssignError(null);
  }

  function closeAssign() {
    if (assignSaving) return;
    setAssignTask(null);
    setAssignEmployeeId("");
    setAssignError(null);
    clearDirtyPhoto();
  }

  function resetAssignState() {
    setAssignTask(null);
    setAssignEmployeeId("");
    setAssignError(null);
    clearDirtyPhoto();
  }

  function openMarkDone(task: HousekeepingTask) {
    clearCleanPhoto();
    setDoneTask(task);
    setDoneError(null);
  }

  function closeMarkDone() {
    if (doneSaving) return;
    setDoneTask(null);
    setDoneError(null);
    clearCleanPhoto();
  }

  function resetDoneState() {
    setDoneTask(null);
    setDoneError(null);
    clearCleanPhoto();
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignTask) return;
    const employee = assigneeOptions.find((a) => a.id === assignEmployeeId);
    if (!employee) {
      setAssignError("Pick who will clean this room.");
      return;
    }
    if (!dirtyPhotoFile) {
      setAssignError("Upload a photo of the dirty room before assigning.");
      return;
    }

    setAssignSaving(true);
    setAssignError(null);
    try {
      const dirtyRoomImageUrl = await uploadImageToCloudinary(
        dirtyPhotoFile,
        "tabarak/housekeeping",
      );
      await updateHousekeepingTask(assignTask.id, {
        roomId: assignTask.roomId,
        roomNumber: assignTask.roomNumber,
        type: assignTask.type,
        priority: assignTask.priority,
        status: "in_progress",
        assigneeId: employee.id,
        assigneeName: employee.name,
        dueAt: assignTask.dueAt,
        notes: assignTask.notes,
        dirtyRoomImageUrl,
      });
      toastSuccess(
        "Assigned",
        `${employee.name} is cleaning Room ${assignTask.roomNumber}`,
      );
      resetAssignState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not assign.";
      setAssignError(message);
      toastError("Assign failed", message);
    } finally {
      setAssignSaving(false);
    }
  }

  async function submitMarkDone(e: React.FormEvent) {
    e.preventDefault();
    if (!doneTask) return;

    setDoneSaving(true);
    setDoneError(null);
    try {
      let cleanRoomImageUrl: string | null | undefined = undefined;
      if (cleanPhotoFile) {
        cleanRoomImageUrl = await uploadImageToCloudinary(
          cleanPhotoFile,
          "tabarak/housekeeping",
        );
      }
      await updateHousekeepingTask(doneTask.id, {
        roomId: doneTask.roomId,
        roomNumber: doneTask.roomNumber,
        type: doneTask.type,
        priority: doneTask.priority,
        status: "done",
        assigneeId: doneTask.assigneeId,
        assigneeName: doneTask.assigneeName || "Staff",
        dueAt: doneTask.dueAt,
        notes: doneTask.notes,
        ...(cleanRoomImageUrl !== undefined ? { cleanRoomImageUrl } : {}),
      });
      toastSuccess("Marked done", `Room ${doneTask.roomNumber} is clean`);
      resetDoneState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not mark done.";
      setDoneError(message);
      toastError("Could not mark done", message);
    } finally {
      setDoneSaving(false);
    }
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
        subtitle="Assign with a dirty-room photo, then Mark done (optional clean photo) when finished."
        actions={
          <>
            <div className="min-w-[9rem] flex-1 sm:w-44 sm:flex-none">
              <FancySelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { value: "open", label: "To do" },
                  { value: "all", label: "All" },
                  { value: "pending", label: "Needs cleaning" },
                  { value: "in_progress", label: "Cleaning now" },
                  { value: "done", label: "Done" },
                ]}
              />
            </div>
            <Button
              type="button"
              className="w-full shrink-0 cursor-pointer sm:w-auto"
              icon={<Plus className="h-4 w-4" />}
              onClick={openCreate}
            >
              Add task
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="To do" value={String(stats.open)} hint="Not finished yet" />
        <StatCard label="Cleaning now" value={String(stats.inProgress)} />
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
          <div className="w-full sm:w-48 sm:shrink-0">
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
          <div>
            <p className="font-bold">Cleaning tasks</p>
            <p className="text-xs text-muted">
              <span className="font-semibold text-app">Assign</span> (dirty photo) starts cleaning.
              Then only <span className="font-semibold text-app">Mark done</span> shows — add a clean
              photo if you want.
            </p>
          </div>
        </div>
        <Table
          headers={[
            t.common.room,
            t.common.type,
            "Priority",
            "Who is cleaning",
            "Due",
            t.status,
            "Photos",
            t.common.actions,
          ]}
          colWidths={["8%", "12%", "9%", "14%", "12%", "12%", "14%", "19%"]}
        >
          {filtered.length === 0 ? (
            <Tr>
              <Td className="text-muted" colSpan={8}>
                No tasks here. When a guest checks out, a “Needs cleaning” task appears — Assign
                someone with a dirty-room photo, then Mark done.
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
                    <span className="text-muted">Not assigned</span>
                  )}
                </Td>
                <Td className="text-muted">{formatDue(task.dueAt)}</Td>
                <Td>
                  <Badge tone={statusTone[task.status]}>{statusLabel[task.status]}</Badge>
                </Td>
                <Td>
                  <div className="flex gap-1.5">
                    {task.dirtyRoomImageUrl ? (
                      <a
                        href={task.dirtyRoomImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Dirty room"
                        className="block h-10 w-10 overflow-hidden rounded-lg border border-app"
                      >
                        <img
                          src={task.dirtyRoomImageUrl}
                          alt="Dirty room"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ) : null}
                    {task.cleanRoomImageUrl ? (
                      <a
                        href={task.cleanRoomImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Clean room"
                        className="block h-10 w-10 overflow-hidden rounded-lg border border-app"
                      >
                        <img
                          src={task.cleanRoomImageUrl}
                          alt="Clean room"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ) : null}
                    {!task.dirtyRoomImageUrl && !task.cleanRoomImageUrl ? (
                      <span className="text-xs text-muted">—</span>
                    ) : null}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {task.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="gold"
                        className="cursor-pointer"
                        icon={<UserPlus className="h-3.5 w-3.5" />}
                        onClick={() => openAssign(task)}
                      >
                        Assign
                      </Button>
                    ) : null}
                    {task.status === "in_progress" ? (
                      <Button
                        size="sm"
                        className="cursor-pointer"
                        icon={<Check className="h-3.5 w-3.5" />}
                        onClick={() => openMarkDone(task)}
                      >
                        Mark done
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => openEdit(task)}
                    >
                      Edit
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))
          )}
        </Table>
      </Card>

      <Modal
        open={Boolean(assignTask)}
        onClose={closeAssign}
        title="Assign cleaner"
        subtitle={
          assignTask
            ? `Room ${assignTask.roomNumber} — upload a dirty-room photo and pick who cleans.`
            : undefined
        }
        footer={
          <>
            <Button type="button" variant="secondary" disabled={assignSaving} onClick={closeAssign}>
              Cancel
            </Button>
            <Button type="submit" form="hk-assign-form" variant="gold" disabled={assignSaving}>
              {assignSaving ? "Assigning…" : "Assign & start"}
            </Button>
          </>
        }
      >
        <form id="hk-assign-form" className="space-y-4" onSubmit={(e) => void submitAssign(e)}>
          {assignError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {assignError}
            </p>
          ) : null}
          <SelectField label="Who will clean this room?">
            <FancySelect
              value={assignEmployeeId}
              onChange={setAssignEmployeeId}
              placeholder={
                assigneeOptions.length ? "Select staff" : "Add employees first"
              }
              options={assigneeOptions.map((e) => ({
                value: e.id,
                label: `${e.name} · ${e.shift}`,
                description: e.designation || undefined,
              }))}
            />
          </SelectField>

          <input
            ref={dirtyPhotoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickDirtyPhoto(e.target.files?.[0] ?? null)}
          />
          <PhotoUploadSlot
            label="Dirty room photo"
            required
            preview={dirtyPhotoPreview}
            onPick={() => dirtyPhotoRef.current?.click()}
            onClear={clearDirtyPhoto}
          />

          <p className="text-sm text-muted">
            After you assign, this task shows as <strong>Cleaning now</strong> with only{" "}
            <strong>Mark done</strong> — Assign is hidden.
          </p>
          {!assigneeOptions.length ? (
            <p className="text-sm text-muted">
              Tip: add active staff under Employees (Housekeeping) so you can assign them.
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(doneTask)}
        onClose={closeMarkDone}
        title="Mark room clean"
        subtitle={
          doneTask
            ? `Room ${doneTask.roomNumber}${doneTask.assigneeName ? ` · ${doneTask.assigneeName}` : ""} — optionally add a clean-room photo.`
            : undefined
        }
        footer={
          <>
            <Button type="button" variant="secondary" disabled={doneSaving} onClick={closeMarkDone}>
              Cancel
            </Button>
            <Button type="submit" form="hk-done-form" disabled={doneSaving}>
              {doneSaving ? "Saving…" : "Mark done"}
            </Button>
          </>
        }
      >
        <form id="hk-done-form" className="space-y-4" onSubmit={(e) => void submitMarkDone(e)}>
          {doneError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {doneError}
            </p>
          ) : null}

          {doneTask?.dirtyRoomImageUrl ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Dirty room (at assign)
              </p>
              <a
                href={doneTask.dirtyRoomImageUrl}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl border border-app"
              >
                <img
                  src={doneTask.dirtyRoomImageUrl}
                  alt="Dirty room"
                  className="h-36 w-full object-cover"
                />
              </a>
            </div>
          ) : null}

          <input
            ref={cleanPhotoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickCleanPhoto(e.target.files?.[0] ?? null)}
          />
          <PhotoUploadSlot
            label="Clean room photo (optional)"
            preview={cleanPhotoPreview}
            onPick={() => cleanPhotoRef.current?.click()}
            onClear={clearCleanPhoto}
          />

          <p className="text-sm text-muted">
            Room will be marked clean and available for the next guest.
          </p>
        </form>
      </Modal>

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
                  description: e.designation || undefined,
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
                { value: "pending", label: "Needs cleaning" },
                { value: "in_progress", label: "Cleaning now" },
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
              Tip: add active staff under Employees so you can assign tasks.
            </p>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}

function PhotoUploadSlot({
  label,
  preview,
  onPick,
  onClear,
  required,
}: {
  label: string;
  preview: string | null;
  onPick: () => void;
  onClear: () => void;
  required?: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-app bg-app p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </p>
      {preview ? (
        <div className="space-y-2">
          <img
            src={preview}
            alt={label}
            className="h-36 w-full rounded-lg border border-app object-cover"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onPick}>
              Change
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<X className="h-3.5 w-3.5" />}
              onClick={onClear}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg px-3 py-8 text-muted transition hover:text-app"
        >
          <ImagePlus className="h-7 w-7 opacity-50" />
          <span className="text-xs font-semibold">Tap to upload photo</span>
        </button>
      )}
    </div>
  );
}
