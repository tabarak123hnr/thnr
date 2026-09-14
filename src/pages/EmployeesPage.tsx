import {
  Award,
  Briefcase,
  Clock,
  Eye,
  FileText,
  IdCard,
  ImagePlus,
  Lock,
  Mail,
  MapPin,
  Maximize2,
  Pencil,
  Phone,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, TextArea } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { uploadImageToCloudinary } from "../lib/cloudinary";
import { scoreEmployeeDuties, scoreTone, todayIsoDate, type EmployeeDutyScore } from "../lib/dutyPerformance";
import {
  createEmployee,
  deleteEmployee,
  subscribeEmployees,
  updateEmployee,
  type Employee,
  type EmployeeShift,
  type EmployeeStatus,
} from "../services/employees";
import { subscribeDuties, type DutyAssignment } from "../services/duties";
import { confirmCurrentUserPassword } from "../services/userManagement";
import { EMPLOYEE_SHIFTS } from "../types/employee";

const statusTone: Record<EmployeeStatus, "success" | "warning" | "muted"> = {
  active: "success",
  on_leave: "warning",
  inactive: "muted",
};

const statusLabel: Record<EmployeeStatus, string> = {
  active: "Active",
  on_leave: "On leave",
  inactive: "Inactive",
};

function mapReauthError(err: unknown) {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "Incorrect password. Try again.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Wait a moment and try again.";
  }
  return err instanceof Error ? err.message : "Could not verify password.";
}

const emptyForm = () => ({
  name: "",
  phone: "",
  email: "",
  designation: "",
  shift: "Morning" as EmployeeShift,
  status: "active" as EmployeeStatus,
  address: "",
  backgroundInformation: "",
  notes: "",
});

function employeeInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function EmployeesPage() {
  const { t } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();
  const cnicFrontRef = useRef<HTMLInputElement>(null);
  const cnicBackRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [duties, setDuties] = useState<DutyAssignment[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | EmployeeStatus>("all");

  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [viewRow, setViewRow] = useState<Employee | null>(null);
  const [cnicLightbox, setCnicLightbox] = useState<{ src: string; label: string } | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [cnicFrontFile, setCnicFrontFile] = useState<File | null>(null);
  const [cnicBackFile, setCnicBackFile] = useState<File | null>(null);
  const [cnicFrontPreview, setCnicFrontPreview] = useState<string | null>(null);
  const [cnicBackPreview, setCnicBackPreview] = useState<string | null>(null);
  const [existingCnicFrontUrl, setExistingCnicFrontUrl] = useState<string | null>(null);
  const [existingCnicBackUrl, setExistingCnicBackUrl] = useState<string | null>(null);

  const [passwordModal, setPasswordModal] = useState(false);
  const [secureAction, setSecureAction] = useState<"edit" | "delete" | null>(null);
  const [pendingEmployee, setPendingEmployee] = useState<Employee | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const a = subscribeEmployees(setEmployees);
    const b = subscribeDuties(setDuties);
    return () => {
      a();
      b();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cnicFrontPreview) URL.revokeObjectURL(cnicFrontPreview);
      if (cnicBackPreview) URL.revokeObjectURL(cnicBackPreview);
    };
  }, [cnicFrontPreview, cnicBackPreview]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return employees;
    return employees.filter((e) => e.status === statusFilter);
  }, [employees, statusFilter]);

  const today = todayIsoDate();
  const scoresById = useMemo(() => {
    const map = new Map<string, EmployeeDutyScore>();
    for (const emp of employees) {
      map.set(emp.id, scoreEmployeeDuties(duties, emp, today));
    }
    return map;
  }, [employees, duties, today]);

  function resetCnicMedia() {
    if (cnicFrontPreview) URL.revokeObjectURL(cnicFrontPreview);
    if (cnicBackPreview) URL.revokeObjectURL(cnicBackPreview);
    setCnicFrontFile(null);
    setCnicBackFile(null);
    setCnicFrontPreview(null);
    setCnicBackPreview(null);
    setExistingCnicFrontUrl(null);
    setExistingCnicBackUrl(null);
    if (cnicFrontRef.current) cnicFrontRef.current.value = "";
    if (cnicBackRef.current) cnicBackRef.current.value = "";
  }

  function onPickCnic(side: "front" | "back", file: File | null) {
    if (side === "front") {
      if (cnicFrontPreview) URL.revokeObjectURL(cnicFrontPreview);
      if (!file) {
        setCnicFrontFile(null);
        setCnicFrontPreview(null);
        return;
      }
      setCnicFrontFile(file);
      setCnicFrontPreview(URL.createObjectURL(file));
    } else {
      if (cnicBackPreview) URL.revokeObjectURL(cnicBackPreview);
      if (!file) {
        setCnicBackFile(null);
        setCnicBackPreview(null);
        return;
      }
      setCnicBackFile(file);
      setCnicBackPreview(URL.createObjectURL(file));
    }
  }

  function openCreate() {
    resetCnicMedia();
    setForm(emptyForm());
    setFormError(null);
    setEditingId(null);
    setMode("create");
  }

  function fillEdit(emp: Employee) {
    resetCnicMedia();
    setForm({
      name: emp.name,
      phone: emp.phone,
      email: emp.email,
      designation: emp.designation,
      shift: emp.shift,
      status: emp.status,
      address: emp.address ?? "",
      backgroundInformation: emp.backgroundInformation ?? "",
      notes: emp.notes ?? "",
    });
    setExistingCnicFrontUrl(emp.cnicFrontImageUrl);
    setExistingCnicBackUrl(emp.cnicBackImageUrl);
    setEditingId(emp.id);
    setFormError(null);
    setMode("edit");
  }

  function requestSecure(emp: Employee, action: "edit" | "delete") {
    setPendingEmployee(emp);
    setSecureAction(action);
    setAdminPassword("");
    setPasswordError(null);
    setPasswordModal(true);
  }

  async function submitPasswordGate(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingEmployee || !secureAction) return;
    setVerifying(true);
    setPasswordError(null);
    try {
      await confirmCurrentUserPassword(adminPassword);
      const emp = pendingEmployee;
      const action = secureAction;
      setPasswordModal(false);
      setAdminPassword("");
      setPendingEmployee(null);
      setSecureAction(null);
      if (action === "edit") {
        fillEdit(emp);
      } else {
        await deleteEmployee(emp.id);
        toastSuccess("Employee removed", emp.name);
      }
    } catch (err) {
      setPasswordError(mapReauthError(err));
    } finally {
      setVerifying(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setFormError("Phone is required.");
      return;
    }
    if (!form.designation.trim()) {
      setFormError("Designation is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      let cnicFrontUrl: string | null = existingCnicFrontUrl;
      let cnicBackUrl: string | null = existingCnicBackUrl;
      if (cnicFrontFile) {
        cnicFrontUrl = await uploadImageToCloudinary(
          cnicFrontFile,
          "tabarak/employees",
        );
      }
      if (cnicBackFile) {
        cnicBackUrl = await uploadImageToCloudinary(
          cnicBackFile,
          "tabarak/employees",
        );
      }

      const payload = {
        ...form,
        cnicFrontImageUrl: cnicFrontUrl,
        cnicBackImageUrl: cnicBackUrl,
      };

      if (mode === "edit" && editingId) {
        await updateEmployee(editingId, payload);
        toastSuccess("Employee updated", form.name.trim());
      } else {
        await createEmployee(payload);
        toastSuccess("Employee added", form.name.trim());
      }
      setMode(null);
      resetCnicMedia();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save employee.";
      setFormError(message);
      toastError("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.employeesTitle}
        subtitle="Staff roster with address, background, and CNIC — used for housekeeping and other tasks."
        actions={
          <>
            <div className="min-w-[9rem] flex-1 sm:w-36 sm:flex-none">
              <FancySelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { value: "all", label: "All status" },
                  { value: "active", label: "Active" },
                  { value: "on_leave", label: "On leave" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </div>
            <Button
              type="button"
              className="w-full shrink-0 cursor-pointer sm:w-auto"
              icon={<Plus className="h-4 w-4" />}
              onClick={openCreate}
            >
              Add employee
            </Button>
          </>
        }
      />

      <Card>
        <Table
          headers={[
            t.common.name,
            "Designation",
            t.common.phone,
            t.common.shift,
            "Score",
            t.status,
            t.common.actions,
          ]}
          colWidths={["16%", "14%", "14%", "10%", "12%", "10%", "24%"]}
        >
          {filtered.length === 0 ? (
            <Tr>
              <Td className="text-muted" colSpan={7}>
                No employees yet. Add housekeeping staff first so you can assign cleaning tasks.
              </Td>
            </Tr>
          ) : (
            filtered.map((emp) => (
              <Tr key={emp.id}>
                <Td className="font-semibold">{emp.name}</Td>
                <Td>
                  <Badge tone="gold">{emp.designation || "—"}</Badge>
                </Td>
                <Td className="text-muted">{emp.phone}</Td>
                <Td>{emp.shift}</Td>
                <Td>
                  {(() => {
                    const score = scoresById.get(emp.id);
                    if (!score) return "—";
                    return (
                      <Badge tone={scoreTone(score.score, score.hasScoredTasks)}>
                        {score.hasScoredTasks ? `${score.score}%` : "—"}
                      </Badge>
                    );
                  })()}
                </Td>
                <Td>
                  <Badge tone={statusTone[emp.status]}>{statusLabel[emp.status]}</Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500"
                      icon={<Eye className="h-3.5 w-3.5" />}
                      onClick={() => setViewRow(emp)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="gold"
                      className="cursor-pointer"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => requestSecure(emp, "edit")}
                    >
                      {t.common.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="cursor-pointer"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => requestSecure(emp, "delete")}
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

      <Modal
        open={Boolean(viewRow)}
        onClose={() => {
          if (cnicLightbox) {
            setCnicLightbox(null);
            return;
          }
          setViewRow(null);
        }}
        title="Employee profile"
        subtitle={
          viewRow
            ? `${viewRow.designation || "Staff"} · ${statusLabel[viewRow.status]}`
            : undefined
        }
        xl
        footer={
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setViewRow(null);
              setCnicLightbox(null);
            }}
          >
            Close
          </Button>
        }
      >
        {viewRow ? (
          <EmployeeProfile
            employee={viewRow}
            score={scoresById.get(viewRow.id) ?? null}
            onOpenCnic={(src, label) => setCnicLightbox({ src, label })}
          />
        ) : null}
      </Modal>

      {cnicLightbox ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/80 backdrop-blur-sm"
            aria-label="Close image"
            onClick={() => setCnicLightbox(null)}
          />
          <div className="relative z-10 w-full max-w-3xl">
            <div className="mb-3 flex items-center justify-between gap-3 text-white">
              <p className="text-sm font-semibold tracking-wide">{cnicLightbox.label}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="!text-white hover:!bg-white/10"
                onClick={() => setCnicLightbox(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <img
              src={cnicLightbox.src}
              alt={cnicLightbox.label}
              className="max-h-[80dvh] w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}

      <Modal
        open={passwordModal}
        onClose={() => {
          if (verifying) return;
          setPasswordModal(false);
          setPendingEmployee(null);
          setSecureAction(null);
          setAdminPassword("");
          setPasswordError(null);
        }}
        title={secureAction === "delete" ? "Confirm delete" : "Confirm edit"}
        subtitle={
          secureAction === "delete"
            ? `Enter your login password to delete ${pendingEmployee?.name ?? "this employee"}.`
            : `Enter your login password to edit ${pendingEmployee?.name ?? "this employee"}.`
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={verifying}
              onClick={() => {
                setPasswordModal(false);
                setPendingEmployee(null);
                setSecureAction(null);
              }}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              form="employee-password-gate"
              variant={secureAction === "delete" ? "danger" : "gold"}
              disabled={verifying}
            >
              {verifying
                ? "Verifying…"
                : secureAction === "delete"
                  ? "Verify & delete"
                  : "Verify & edit"}
            </Button>
          </>
        }
      >
        <form id="employee-password-gate" className="space-y-4" onSubmit={submitPasswordGate}>
          {passwordError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {passwordError}
            </p>
          ) : null}
          <div className="rounded-xl border border-app bg-app px-4 py-3 text-sm text-muted">
            For security, we re-check <span className="font-semibold text-app">your</span> password
            before changing staff records.
          </div>
          <Field label="Your password">
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                required
                type="password"
                autoComplete="current-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter your account password"
                className="ps-10"
              />
            </div>
          </Field>
        </form>
      </Modal>

      <Modal
        open={mode != null}
        onClose={() => {
          if (saving) return;
          setMode(null);
          resetCnicMedia();
        }}
        title={mode === "edit" ? "Edit employee" : "Add employee"}
        subtitle="Add address, background information, and CNIC photos. Housekeeping staff appear as cleaning assignees."
        xl
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setMode(null);
                resetCnicMedia();
              }}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" form="employee-form" disabled={saving}>
              {saving ? "Saving…" : t.common.save}
            </Button>
          </>
        }
      >
        <form id="employee-form" className="space-y-5" onSubmit={submit}>
          {formError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.common.name}>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </Field>
            <Field label="Designation">
              <Input
                required
                value={form.designation}
                onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))}
                placeholder="Room attendant, Supervisor, Chef…"
              />
            </Field>
            <SelectField label={t.common.shift}>
              <FancySelect
                value={form.shift}
                onChange={(shift) => setForm((p) => ({ ...p, shift: shift as EmployeeShift }))}
                options={EMPLOYEE_SHIFTS.map((s) => ({ value: s, label: s }))}
              />
            </SelectField>
            <SelectField label={t.status}>
              <FancySelect
                value={form.status}
                onChange={(status) =>
                  setForm((p) => ({ ...p, status: status as EmployeeStatus }))
                }
                options={[
                  { value: "active", label: "Active" },
                  { value: "on_leave", label: "On leave" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </SelectField>
            <Field label={t.common.phone}>
              <Input
                required
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </Field>
            <Field label={t.common.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <TextArea
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                rows={2}
                placeholder="House / street, city, district"
              />
            </Field>
          </div>

          <Field label="Background information">
            <TextArea
              value={form.backgroundInformation}
              onChange={(e) =>
                setForm((p) => ({ ...p, backgroundInformation: e.target.value }))
              }
              rows={4}
              placeholder="Previous work, education, family, or other background"
            />
          </Field>

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
              CNIC photos
            </p>
            <input
              ref={cnicFrontRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickCnic("front", e.target.files?.[0] ?? null)}
            />
            <input
              ref={cnicBackRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickCnic("back", e.target.files?.[0] ?? null)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <CnicUploadSlot
                label="CNIC front"
                preview={cnicFrontPreview || existingCnicFrontUrl}
                onPick={() => cnicFrontRef.current?.click()}
                onClear={() => {
                  onPickCnic("front", null);
                  setExistingCnicFrontUrl(null);
                }}
              />
              <CnicUploadSlot
                label="CNIC back"
                preview={cnicBackPreview || existingCnicBackUrl}
                onPick={() => cnicBackRef.current?.click()}
                onClear={() => {
                  onPickCnic("back", null);
                  setExistingCnicBackUrl(null);
                }}
              />
            </div>
          </div>

          <Field label={t.common.notes}>
            <TextArea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function CnicUploadSlot({
  label,
  preview,
  onPick,
  onClear,
}: {
  label: string;
  preview: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-app bg-app p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      {preview ? (
        <div className="space-y-2">
          <img
            src={preview}
            alt={label}
            className="h-28 w-full rounded-lg border border-app object-cover"
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
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg px-3 py-6 text-muted transition hover:text-app"
        >
          <ImagePlus className="h-6 w-6 opacity-50" />
          <span className="text-xs font-semibold">Upload {label.toLowerCase()}</span>
        </button>
      )}
    </div>
  );
}

function EmployeeProfile({
  employee,
  score,
  onOpenCnic,
}: {
  employee: Employee;
  score: EmployeeDutyScore | null;
  onOpenCnic: (src: string, label: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-app">
        <div
          className="h-24"
          style={{
            background:
              "linear-gradient(135deg, #07101f 0%, #12284a 48%, #c5a059 100%)",
          }}
        />
        <div className="bg-elevated px-5 pb-5">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-2xl border-4 border-[var(--bg-elevated)] bg-accent text-2xl font-extrabold text-[var(--accent-text)] shadow-lg">
              {employeeInitials(employee.name)}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h3 className="text-xl font-extrabold tracking-tight">{employee.name}</h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                {employee.designation || "Staff"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              <Badge tone="gold">{employee.shift}</Badge>
              <Badge tone={statusTone[employee.status]}>
                {statusLabel[employee.status]}
              </Badge>
              {score ? (
                <Badge tone={scoreTone(score.score, score.hasScoredTasks)}>
                  {score.hasScoredTasks ? `${score.score}%` : "No score yet"}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {score ? (
        <section className="rounded-2xl border border-app bg-app px-4 py-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
            <Award className="h-3.5 w-3.5" />
            Performance assessment
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Score</p>
              <p className="mt-0.5 text-lg font-extrabold">
                {score.hasScoredTasks ? `${score.score}%` : "—"}
              </p>
              <p className="text-xs text-muted">{score.label}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Earned</p>
              <p className="mt-0.5 text-lg font-extrabold">+{score.earnedPoints}</p>
              <p className="text-xs text-muted">
                {score.completed} of {score.assigned} tasks done
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Deducted</p>
              <p className="mt-0.5 text-lg font-extrabold">−{score.deductedPoints}</p>
              <p className="text-xs text-muted">
                {score.missed} missed{score.pending ? ` · ${score.pending} pending` : ""}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg)]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${score.hasScoredTasks ? score.score : 0}%` }}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoTile
          icon={<Phone className="h-4 w-4" />}
          label="Phone"
          value={employee.phone || "—"}
        />
        <InfoTile
          icon={<Mail className="h-4 w-4" />}
          label="Email"
          value={employee.email || "—"}
        />
        <InfoTile
          icon={<Clock className="h-4 w-4" />}
          label="Shift"
          value={employee.shift}
        />
        <InfoTile
          icon={<MapPin className="h-4 w-4" />}
          label="Address"
          value={employee.address || "—"}
        />
      </div>

      <section className="rounded-2xl border border-app bg-app px-4 py-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
          <FileText className="h-3.5 w-3.5" />
          Background information
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-app">
          {(employee.backgroundInformation ?? "").trim()
            ? employee.backgroundInformation
            : "No background information on file."}
        </p>
      </section>

      {(employee.notes ?? "").trim() ? (
        <section className="rounded-2xl border border-dashed border-app px-4 py-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Notes</p>
          <p className="whitespace-pre-wrap text-sm text-muted">{employee.notes}</p>
        </section>
      ) : null}

      <section>
        <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
          <IdCard className="h-3.5 w-3.5" />
          CNIC documents
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CnicPreviewCard
            label="CNIC front"
            src={employee.cnicFrontImageUrl}
            onOpen={onOpenCnic}
          />
          <CnicPreviewCard
            label="CNIC back"
            src={employee.cnicBackImageUrl}
            onOpen={onOpenCnic}
          />
        </div>
      </section>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-app bg-app px-3.5 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-[var(--accent)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-0.5 font-semibold break-words">{value}</p>
      </div>
    </div>
  );
}

function CnicPreviewCard({
  label,
  src,
  onOpen,
}: {
  label: string;
  src: string | null;
  onOpen: (src: string, label: string) => void;
}) {
  if (!src) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-app bg-app px-4 py-8 text-center">
        <IdCard className="h-8 w-8 text-muted opacity-40" />
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-xs text-muted">No image uploaded</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(src, label)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-app bg-app text-start shadow-sm transition hover:border-[var(--accent)] hover:shadow-md"
    >
      <p className="absolute start-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
        {label}
      </p>
      <img src={src} alt={label} className="h-48 w-full object-cover" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-[var(--text)]">
          <Maximize2 className="h-3.5 w-3.5" />
          View full size
        </span>
      </div>
    </button>
  );
}
