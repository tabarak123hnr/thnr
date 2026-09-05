import { Eye, ImagePlus, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  createEmployee,
  deleteEmployee,
  subscribeEmployees,
  updateEmployee,
  type Employee,
  type EmployeeShift,
  type EmployeeStatus,
} from "../services/employees";
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
  notes: "",
});

export function EmployeesPage() {
  const { t } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();
  const cnicFrontRef = useRef<HTMLInputElement>(null);
  const cnicBackRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | EmployeeStatus>("all");

  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [viewRow, setViewRow] = useState<Employee | null>(null);
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

  useEffect(() => subscribeEmployees(setEmployees), []);

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
      notes: emp.notes,
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
        subtitle="Staff roster with designation and CNIC — used for housekeeping and other tasks."
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
            t.status,
            t.common.actions,
          ]}
          colWidths={["18%", "18%", "16%", "12%", "12%", "24%"]}
        >
          {filtered.length === 0 ? (
            <Tr>
              <Td className="text-muted" colSpan={6}>
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
        onClose={() => setViewRow(null)}
        title="Employee details"
        wide
        footer={
          <Button type="button" variant="secondary" onClick={() => setViewRow(null)}>
            Close
          </Button>
        }
      >
        {viewRow ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label={t.common.name} value={viewRow.name} />
              <Detail label="Designation" value={viewRow.designation || "—"} />
              <Detail label={t.common.shift} value={viewRow.shift} />
              <Detail label={t.common.phone} value={viewRow.phone} />
              <Detail label={t.common.email} value={viewRow.email || "—"} />
              <Detail label={t.status} value={statusLabel[viewRow.status]} />
              {viewRow.notes ? (
                <div className="sm:col-span-2">
                  <Detail label={t.common.notes} value={viewRow.notes} />
                </div>
              ) : null}
            </div>
            {(viewRow.cnicFrontImageUrl || viewRow.cnicBackImageUrl) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {viewRow.cnicFrontImageUrl ? (
                  <a
                    href={viewRow.cnicFrontImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block"
                  >
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                      CNIC front
                    </p>
                    <img
                      src={viewRow.cnicFrontImageUrl}
                      alt="CNIC front"
                      className="h-36 w-full rounded-xl border border-app object-cover"
                    />
                  </a>
                ) : null}
                {viewRow.cnicBackImageUrl ? (
                  <a
                    href={viewRow.cnicBackImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block"
                  >
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                      CNIC back
                    </p>
                    <img
                      src={viewRow.cnicBackImageUrl}
                      alt="CNIC back"
                      className="h-36 w-full rounded-xl border border-app object-cover"
                    />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

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
        subtitle="Add designation and CNIC photos. Housekeeping staff appear as cleaning assignees."
        wide
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
          </div>

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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-app px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-semibold break-all">{value}</p>
    </div>
  );
}
