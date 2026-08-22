import { Eye, IdCard, ImagePlus, Lock, LogOut, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, TextArea } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { calcCheckoutBill, calcRoomBill } from "../lib/billing";
import { uploadImageToCloudinary } from "../lib/cloudinary";
import { formatRs } from "../lib/utils";
import {
  checkoutGuest,
  createCheckIn,
  subscribeCheckIns,
  updateCheckIn,
  type CheckInCompanion,
  type CheckInRecord,
  type PaymentTiming,
} from "../services/checkIns";
import { subscribeRooms, type HotelRoom } from "../services/rooms";
import { confirmCurrentUserPassword } from "../services/userManagement";

const PURPOSE_OPTIONS = [
  { value: "leisure", label: "Leisure" },
  { value: "business", label: "Business" },
  { value: "family", label: "Family" },
  { value: "other", label: "Other" },
];

const PAYMENT_OPTIONS: { value: PaymentTiming; label: string; description: string }[] = [
  {
    value: "paid_at_checkin",
    label: "Paid cash at check-in",
    description: "Marked paid now. Bill still tracked for records.",
  },
  {
    value: "due_on_checkout",
    label: "Pay on checkout",
    description: "Payment becomes due when the guest checks out.",
  },
];

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isoToLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return toLocalInputValue(new Date());
  return toLocalInputValue(d);
}

function defaultCheckOut() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return toLocalInputValue(d);
}

function formatDateTime(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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

type CompanionForm = {
  name: string;
  cnic: string;
  phone: string;
  relation: string;
};

const emptyCompanion = (): CompanionForm => ({
  name: "",
  cnic: "",
  phone: "",
  relation: "",
});

function emptyForm() {
  return {
    guestName: "",
    phone: "",
    cnic: "",
    nationality: "Pakistan",
    purpose: "leisure",
    roomId: "",
    adults: "1",
    children: "0",
    checkInAt: toLocalInputValue(new Date()),
    checkOutAt: defaultCheckOut(),
    notes: "",
    paymentTiming: "due_on_checkout" as PaymentTiming,
  };
}

function BillSummary({
  nights,
  nightlyRate,
  totalBill,
  rs,
}: {
  nights: number;
  nightlyRate: number;
  totalBill: number;
  rs: string;
}) {
  return (
    <div className="rounded-2xl border border-[color-mix(in_oklab,var(--accent)_40%,var(--border))] bg-accent-soft px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">Room bill</p>
      <p className="mt-1 text-sm text-muted">
        {nights} night{nights === 1 ? "" : "s"} × {formatRs(nightlyRate, rs)}
      </p>
      <p className="mt-1 text-xl font-extrabold text-[var(--accent)]">
        {formatRs(totalBill, rs)}
      </p>
    </div>
  );
}

export function CheckInPage() {
  const { t, language } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();
  const cnicFileRef = useRef<HTMLInputElement>(null);

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "checked_in" | "checked_out">("all");

  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [viewRow, setViewRow] = useState<CheckInRecord | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lockedRoomId, setLockedRoomId] = useState<string | null>(null);
  const [passwordModal, setPasswordModal] = useState(false);
  const [secureAction, setSecureAction] = useState<"edit" | "checkout" | null>(null);
  const [pendingEdit, setPendingEdit] = useState<CheckInRecord | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [companions, setCompanions] = useState<CompanionForm[]>([]);
  const [cnicFile, setCnicFile] = useState<File | null>(null);
  const [cnicPreview, setCnicPreview] = useState<string | null>(null);
  const [existingCnicUrl, setExistingCnicUrl] = useState<string | null>(null);
  const [nightlyRate, setNightlyRate] = useState(0);
  const [extraCharges, setExtraCharges] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const unsubRooms = subscribeRooms(setRooms);
    const unsubCheckIns = subscribeCheckIns(setCheckIns);
    return () => {
      unsubRooms();
      unsubCheckIns();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cnicPreview) URL.revokeObjectURL(cnicPreview);
    };
  }, [cnicPreview]);

  const availableRooms = useMemo(
    () => rooms.filter((r) => r.status === "available"),
    [rooms],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return checkIns;
    return checkIns.filter((c) => c.status === filter);
  }, [checkIns, filter]);

  const selectedRoom = rooms.find((r) => r.id === form.roomId) ?? null;

  const liveBill = useMemo(() => {
    const rate = nightlyRate || selectedRoom?.rate || 0;
    if (!form.checkInAt || !form.checkOutAt || !rate) {
      return { nights: 0, nightlyRate: rate, roomCharges: 0, extraCharges, totalBill: 0 };
    }
    try {
      return calcRoomBill(
        rate,
        new Date(form.checkInAt).toISOString(),
        new Date(form.checkOutAt).toISOString(),
        extraCharges,
      );
    } catch {
      return { nights: 1, nightlyRate: rate, roomCharges: rate, extraCharges, totalBill: rate + extraCharges };
    }
  }, [form.checkInAt, form.checkOutAt, nightlyRate, selectedRoom?.rate, extraCharges]);

  const partySize = Math.max(1, Number(form.adults || 1) + Number(form.children || 0));
  const showCompanions = partySize > 1;
  const formOpen = mode === "create" || mode === "edit";

  function resetMedia() {
    if (cnicPreview) URL.revokeObjectURL(cnicPreview);
    setCnicFile(null);
    setCnicPreview(null);
    setExistingCnicUrl(null);
  }

  function openCreate() {
    resetMedia();
    setForm(emptyForm());
    setCompanions([]);
    setNightlyRate(0);
    setExtraCharges(0);
    setFormError(null);
    setEditingId(null);
    setLockedRoomId(null);
    setMode("create");
  }

  function openEdit(row: CheckInRecord) {
    resetMedia();
    setForm({
      guestName: row.guestName,
      phone: row.phone,
      cnic: row.cnic,
      nationality: row.nationality || "Pakistan",
      purpose: row.purpose || "leisure",
      roomId: row.roomId,
      adults: String(row.adults || 1),
      children: String(row.children || 0),
      checkInAt: isoToLocalInput(row.checkInAt),
      checkOutAt: isoToLocalInput(row.checkOutAt),
      notes: row.notes || "",
      paymentTiming: row.paymentTiming || "due_on_checkout",
    });
    setCompanions(
      row.companions.map((c) => ({
        name: c.name,
        cnic: c.cnic || "",
        phone: c.phone || "",
        relation: c.relation || "",
      })),
    );
    setNightlyRate(row.nightlyRate || rooms.find((r) => r.id === row.roomId)?.rate || 0);
    setExtraCharges(row.extraCharges || 0);
    setExistingCnicUrl(row.cnicImageUrl);
    setFormError(null);
    setEditingId(row.id);
    setLockedRoomId(row.roomId);
    setMode("edit");
  }

  function requestEdit(row: CheckInRecord) {
    setPendingEdit(row);
    setSecureAction("edit");
    setAdminPassword("");
    setPasswordError(null);
    setPasswordModal(true);
  }

  function requestCheckout(row: CheckInRecord) {
    if (row.status !== "checked_in") return;
    setViewRow(null);
    setPendingEdit(row);
    setSecureAction("checkout");
    setAdminPassword("");
    setPasswordError(null);
    setPasswordModal(true);
  }

  const checkoutPreview = useMemo(() => {
    if (!pendingEdit || secureAction !== "checkout") return null;
    return calcCheckoutBill(
      pendingEdit.nightlyRate,
      pendingEdit.checkInAt,
      pendingEdit.plannedCheckOutAt || pendingEdit.checkOutAt,
      new Date().toISOString(),
      pendingEdit.extraCharges || 0,
    );
  }, [pendingEdit, secureAction]);

  function closePasswordModal() {
    if (verifyingPassword || checkingOutId) return;
    setPasswordModal(false);
    setAdminPassword("");
    setPendingEdit(null);
    setSecureAction(null);
    setPasswordError(null);
  }

  async function submitPasswordGate(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingEdit || !secureAction) return;
    setVerifyingPassword(true);
    setPasswordError(null);
    try {
      await confirmCurrentUserPassword(adminPassword);
      const row = pendingEdit;
      const action = secureAction;
      setAdminPassword("");
      setPasswordError(null);

      if (action === "edit") {
        setPasswordModal(false);
        setPendingEdit(null);
        setSecureAction(null);
        openEdit(row);
        return;
      }

      // checkout
      const nowIso = new Date().toISOString();
      setCheckingOutId(row.id);
      try {
        const result = await checkoutGuest(row.id, { mode: "manual", at: nowIso });
        setPasswordModal(false);
        setPendingEdit(null);
        setSecureAction(null);
        if (result) {
          toastSuccess(
            "Checked out",
            result.early
              ? `${result.guestName} · ${result.nights} night(s) · ${formatRs(result.totalBill, t.common.rs)} (was ${result.plannedNights})`
              : `${result.guestName} · ${result.nights} night(s) · ${formatRs(result.totalBill, t.common.rs)}`,
          );
        } else {
          toastSuccess("Checked out", `${row.guestName} · Room ${row.roomNumber}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Checkout failed.";
        setPasswordError(message);
        toastError("Checkout failed", message);
      } finally {
        setCheckingOutId(null);
      }
    } catch (err) {
      setPasswordError(mapReauthError(err));
    } finally {
      setVerifyingPassword(false);
    }
  }

  function onPickCnic(file: File | null) {
    if (cnicPreview) URL.revokeObjectURL(cnicPreview);
    if (!file) {
      setCnicFile(null);
      setCnicPreview(null);
      return;
    }
    setCnicFile(file);
    setCnicPreview(URL.createObjectURL(file));
  }

  function addCompanion() {
    setCompanions((prev) => [...prev, emptyCompanion()]);
  }

  function updateCompanion(index: number, patch: Partial<CompanionForm>) {
    setCompanions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeCompanion(index: number) {
    setCompanions((prev) => prev.filter((_, i) => i !== index));
  }

  function onRoomChange(roomId: string) {
    setForm((p) => ({ ...p, roomId }));
    const room = rooms.find((r) => r.id === roomId);
    if (room) setNightlyRate(room.rate);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const room =
      rooms.find((r) => r.id === form.roomId) ||
      (lockedRoomId ? rooms.find((r) => r.id === lockedRoomId) : undefined);

    if (!form.guestName.trim()) {
      setFormError("Guest name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setFormError("Phone number is required.");
      return;
    }
    if (!form.roomId || !room) {
      setFormError("Select an available room.");
      return;
    }
    if (!form.checkInAt || !form.checkOutAt) {
      setFormError("Check-in and check-out date & time are required.");
      return;
    }
    if (new Date(form.checkOutAt) <= new Date(form.checkInAt)) {
      setFormError("Check-out must be after check-in.");
      return;
    }

    const adults = Math.max(1, Number(form.adults) || 1);
    const children = Math.max(0, Number(form.children) || 0);
    const rate = nightlyRate || room.rate;
    const checkInAt = new Date(form.checkInAt).toISOString();
    const checkOutAt = new Date(form.checkOutAt).toISOString();

    setSaving(true);
    setFormError(null);
    try {
      let cnicImageUrl: string | null | undefined = existingCnicUrl;
      if (cnicFile) {
        cnicImageUrl = await uploadImageToCloudinary(cnicFile, "tabarak/checkins");
      }

      const companionPayload: CheckInCompanion[] =
        adults + children > 1
          ? companions.map((c) => ({
              name: c.name,
              cnic: c.cnic || undefined,
              phone: c.phone || undefined,
              relation: c.relation || undefined,
            }))
          : [];

      if (mode === "edit" && editingId) {
        await updateCheckIn(editingId, {
          roomId: room.id,
          guestName: form.guestName,
          phone: form.phone,
          cnic: form.cnic,
          nationality: form.nationality,
          purpose: form.purpose,
          adults,
          children,
          companions: companionPayload,
          checkInAt,
          checkOutAt,
          notes: form.notes,
          nightlyRate: rate,
          extraCharges,
          cnicImageUrl: cnicImageUrl ?? null,
          paymentTiming: form.paymentTiming,
        });
        toastSuccess("Check-in updated", `Bill is now ${formatRs(liveBill.totalBill, t.common.rs)}`);
      } else {
        await createCheckIn({
          roomId: room.id,
          roomNumber: room.number,
          guestName: form.guestName,
          phone: form.phone,
          cnic: form.cnic,
          nationality: form.nationality,
          purpose: form.purpose,
          adults,
          children,
          companions: companionPayload,
          checkInAt,
          checkOutAt,
          cnicImageUrl: cnicImageUrl ?? null,
          notes: form.notes,
          nightlyRate: rate,
          extraCharges,
          paymentTiming: form.paymentTiming,
        });
        toastSuccess(
          "Checked in",
          `${form.guestName.trim()} → Room ${room.number} · ${formatRs(liveBill.totalBill, t.common.rs)}`,
        );
      }

      setMode(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save check-in.";
      setFormError(message);
      toastError("Check-in failed", message);
    } finally {
      setSaving(false);
    }
  }

  const roomOptions =
    mode === "edit" && lockedRoomId
      ? rooms
          .filter((r) => r.id === lockedRoomId)
          .map((r) => ({
            value: r.id,
            label: `Room ${r.number} · ${language === "ur" && r.typeUr ? r.typeUr : r.type}`,
          }))
      : availableRooms.map((r) => ({
          value: r.id,
          label: `Room ${r.number} · ${language === "ur" && r.typeUr ? r.typeUr : r.type} · ${formatRs(r.rate, t.common.rs)}/night`,
        }));

  return (
    <div>
      <PageHeader
        title={t.pages.checkInTitle}
        subtitle="Register guests, extend stays, and keep room bills in sync."
        actions={
          <>
            <div className="w-40 shrink-0">
              <FancySelect
                value={filter}
                onChange={(v) => setFilter(v as typeof filter)}
                options={[
                  { value: "all", label: "All" },
                  { value: "checked_in", label: "Checked in" },
                  { value: "checked_out", label: "Checked out" },
                ]}
              />
            </div>
            <Button
              type="button"
              className="shrink-0 cursor-pointer"
              icon={<Plus className="h-4 w-4" />}
              onClick={openCreate}
            >
              {t.newCheckIn}
            </Button>
          </>
        }
      />

      {filtered.length === 0 ? (
        <Card className="!p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-[var(--accent)]" />
          <p className="mt-3 font-bold">No check-ins yet</p>
          <p className="mt-1 text-sm text-muted">
            Register a guest and assign them to an available room.
          </p>
          <Button type="button" className="mt-4" onClick={openCreate}>
            {t.newCheckIn}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((row) => (
            <Card key={row.id} className="!p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-extrabold">{row.guestName}</p>
                    <Badge tone={row.status === "checked_in" ? "gold" : "muted"}>
                      {row.status === "checked_in" ? "Checked in" : "Checked out"}
                    </Badge>
                    {row.paymentTiming === "paid_at_checkin" || row.paymentStatus === "paid" ? (
                      <Badge tone="success">Paid</Badge>
                    ) : row.paymentStatus === "due" ? (
                      <Badge tone="danger">Due</Badge>
                    ) : (
                      <Badge tone="warning">Pay on checkout</Badge>
                    )}
                    {row.cnicImageUrl ? <Badge tone="info">CNIC on file</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Room {row.roomNumber} · {row.phone}
                    {row.cnic ? ` · ${row.cnic}` : ""}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="text-muted">{t.common.checkIn}: </span>
                    <span className="font-semibold">{formatDateTime(row.checkInAt)}</span>
                    <span className="mx-2 text-muted">→</span>
                    <span className="text-muted">{t.common.checkOut}: </span>
                    <span className="font-semibold">{formatDateTime(row.checkOutAt)}</span>
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--accent)]">
                    {row.nights || "—"} night(s) · {formatRs(row.totalBill || 0, t.common.rs)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer !bg-sky-600 !text-white hover:!opacity-90"
                    icon={<Eye className="h-3.5 w-3.5" />}
                    onClick={() => setViewRow(row)}
                  >
                    View
                  </Button>
                  {row.status === "checked_in" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="gold"
                        className="cursor-pointer"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        onClick={() => requestEdit(row)}
                      >
                        {t.common.edit}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        className="cursor-pointer"
                        icon={<LogOut className="h-3.5 w-3.5" />}
                        disabled={checkingOutId === row.id}
                        onClick={() => requestCheckout(row)}
                      >
                        {checkingOutId === row.id ? "Checking out…" : "Check out"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title="Check-in details"
        subtitle={viewRow ? `Room ${viewRow.roomNumber}` : undefined}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setViewRow(null)}>
              Close
            </Button>
            {viewRow?.status === "checked_in" ? (
              <>
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => {
                    const row = viewRow;
                    setViewRow(null);
                    if (row) requestEdit(row);
                  }}
                >
                  Edit stay
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  icon={<LogOut className="h-4 w-4" />}
                  disabled={checkingOutId === viewRow.id}
                  onClick={() => requestCheckout(viewRow)}
                >
                  {checkingOutId === viewRow.id ? "Checking out…" : "Check out"}
                </Button>
              </>
            ) : null}
          </>
        }
      >
        {viewRow ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label={t.common.name} value={viewRow.guestName} />
              <Detail label={t.common.phone} value={viewRow.phone} />
              <Detail label={t.common.cnic} value={viewRow.cnic || "—"} />
              <Detail label={t.common.nationality} value={viewRow.nationality || "—"} />
              <Detail label={t.common.checkIn} value={formatDateTime(viewRow.checkInAt)} />
              <Detail label={t.common.checkOut} value={formatDateTime(viewRow.checkOutAt)} />
              <Detail label="Guests" value={`${viewRow.adults} adults · ${viewRow.children} children`} />
              <Detail label="Purpose" value={viewRow.purpose} />
              <Detail
                label="Payment"
                value={
                  viewRow.paymentStatus === "paid"
                    ? "Paid"
                    : viewRow.paymentStatus === "due"
                      ? "Due"
                      : "Pay on checkout"
                }
              />
              <Detail
                label="Payment plan"
                value={
                  viewRow.paymentTiming === "paid_at_checkin"
                    ? "Cash at check-in"
                    : "Due on checkout"
                }
              />
            </div>
            <BillSummary
              nights={viewRow.nights || stayFallbackNights(viewRow)}
              nightlyRate={viewRow.nightlyRate}
              totalBill={viewRow.totalBill}
              rs={t.common.rs}
            />
            {viewRow.companions.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Companions</p>
                <ul className="space-y-1 text-sm">
                  {viewRow.companions.map((c, i) => (
                    <li key={i} className="rounded-lg bg-app px-3 py-2">
                      {c.name}
                      {c.relation ? ` · ${c.relation}` : ""}
                      {c.cnic ? ` · ${c.cnic}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {viewRow.notes ? (
              <p className="rounded-xl bg-app px-3 py-2 text-sm text-muted">{viewRow.notes}</p>
            ) : null}
            {viewRow.cnicImageUrl ? (
              <a href={viewRow.cnicImageUrl} target="_blank" rel="noreferrer" className="inline-block">
                <img
                  src={viewRow.cnicImageUrl}
                  alt="CNIC"
                  className="h-36 w-56 rounded-xl border border-app object-cover"
                />
              </a>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={passwordModal}
        onClose={closePasswordModal}
        title={secureAction === "checkout" ? "Confirm check-out" : "Confirm edit"}
        subtitle={
          secureAction === "checkout"
            ? `Enter your login password to check out ${pendingEdit?.guestName ?? "this guest"}.`
            : `Enter your login password to edit ${pendingEdit?.guestName ?? "this check-in"}.`
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={verifyingPassword || Boolean(checkingOutId)}
              onClick={closePasswordModal}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              form="checkin-password-gate-form"
              variant={secureAction === "checkout" ? "danger" : "gold"}
              disabled={verifyingPassword || Boolean(checkingOutId)}
            >
              {verifyingPassword || checkingOutId
                ? secureAction === "checkout"
                  ? "Checking out…"
                  : "Verifying…"
                : secureAction === "checkout"
                  ? "Verify & check out"
                  : "Verify & edit"}
            </Button>
          </>
        }
      >
        <form id="checkin-password-gate-form" className="space-y-4" onSubmit={submitPasswordGate}>
          {passwordError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {passwordError}
            </p>
          ) : null}

          {secureAction === "checkout" && pendingEdit && checkoutPreview ? (
            <div className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_40%,var(--border))] bg-accent-soft px-4 py-3 text-sm">
              <p className="font-bold">
                Room {pendingEdit.roomNumber} · {pendingEdit.guestName}
              </p>
              {checkoutPreview.early ? (
                <p className="mt-1 text-muted">
                  Early leave — bill adjusts from{" "}
                  <span className="font-semibold text-app">
                    {checkoutPreview.plannedNights} night(s) (
                    {formatRs(checkoutPreview.plannedTotal, t.common.rs)})
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-[var(--accent)]">
                    {checkoutPreview.nights} night(s) (
                    {formatRs(checkoutPreview.totalBill, t.common.rs)})
                  </span>
                  .
                </p>
              ) : (
                <p className="mt-1 text-muted">
                  Bill:{" "}
                  <span className="font-semibold text-[var(--accent)]">
                    {checkoutPreview.nights} night(s) ·{" "}
                    {formatRs(checkoutPreview.totalBill, t.common.rs)}
                  </span>
                </p>
              )}
              <p className="mt-2 text-xs text-muted">
                Room will become available and marked dirty for housekeeping.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-app bg-app px-4 py-3 text-sm text-muted">
              For security, we re-check <span className="font-semibold text-app">your</span> password
              before editing a guest stay.
            </div>
          )}

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
        open={formOpen}
        onClose={() => !saving && setMode(null)}
        title={mode === "edit" ? "Edit check-in" : t.newCheckIn}
        subtitle={
          mode === "edit"
            ? "Extend stay or update guest details — the bill updates automatically."
            : "Guest details, stay times, and price by nights."
        }
        wide
        footer={
          <>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setMode(null)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="check-in-form" disabled={saving}>
              {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Complete check-in"}
            </Button>
          </>
        }
      >
        <form id="check-in-form" className="space-y-5" onSubmit={submit}>
          {formError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Primary guest</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.common.name}>
                <Input
                  required
                  value={form.guestName}
                  onChange={(e) => setForm((p) => ({ ...p, guestName: e.target.value }))}
                  placeholder="Full name"
                />
              </Field>
              <Field label={t.common.phone}>
                <Input
                  required
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="03XX-XXXXXXX"
                />
              </Field>
              <Field label={t.common.cnic}>
                <Input
                  value={form.cnic}
                  onChange={(e) => setForm((p) => ({ ...p, cnic: e.target.value }))}
                  placeholder="XXXXX-XXXXXXX-X"
                />
              </Field>
              <Field label={t.common.nationality}>
                <Input
                  value={form.nationality}
                  onChange={(e) => setForm((p) => ({ ...p, nationality: e.target.value }))}
                />
              </Field>
              <SelectField label={t.common.room}>
                <FancySelect
                  value={form.roomId}
                  onChange={onRoomChange}
                  disabled={mode === "edit"}
                  placeholder={
                    roomOptions.length ? "Select available room" : "No available rooms"
                  }
                  options={roomOptions}
                />
              </SelectField>
              <SelectField label="Purpose of visit">
                <FancySelect
                  value={form.purpose}
                  onChange={(purpose) => setForm((p) => ({ ...p, purpose }))}
                  options={PURPOSE_OPTIONS}
                />
              </SelectField>
              <Field label={t.common.adults}>
                <Input
                  required
                  type="number"
                  min={1}
                  value={form.adults}
                  onChange={(e) => setForm((p) => ({ ...p, adults: e.target.value }))}
                />
              </Field>
              <Field label={t.common.children}>
                <Input
                  type="number"
                  min={0}
                  value={form.children}
                  onChange={(e) => setForm((p) => ({ ...p, children: e.target.value }))}
                />
              </Field>
              <Field label={`${t.common.checkIn} (date & time)`}>
                <Input
                  required
                  type="datetime-local"
                  value={form.checkInAt}
                  onChange={(e) => setForm((p) => ({ ...p, checkInAt: e.target.value }))}
                />
              </Field>
              <Field label={`${t.common.checkOut} (date & time)`}>
                <Input
                  required
                  type="datetime-local"
                  value={form.checkOutAt}
                  onChange={(e) => setForm((p) => ({ ...p, checkOutAt: e.target.value }))}
                />
              </Field>
              <SelectField label="Room payment" className="sm:col-span-2">
                <FancySelect
                  value={form.paymentTiming}
                  onChange={(paymentTiming) =>
                    setForm((p) => ({
                      ...p,
                      paymentTiming: paymentTiming as PaymentTiming,
                    }))
                  }
                  options={PAYMENT_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                    description: o.description,
                  }))}
                />
              </SelectField>
            </div>
          </div>

          {liveBill.nightlyRate > 0 ? (
            <BillSummary
              nights={liveBill.nights}
              nightlyRate={liveBill.nightlyRate}
              totalBill={liveBill.totalBill}
              rs={t.common.rs}
            />
          ) : (
            <p className="rounded-xl bg-app px-3 py-2 text-sm text-muted">
              Select a room to see the bill for this stay.
            </p>
          )}

          {showCompanions ? (
            <div className="rounded-2xl border border-dashed border-app p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">Other guests (optional)</p>
                  <p className="text-xs text-muted">
                    Party size is {partySize}. Add companions if you want them on record.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={addCompanion}
                >
                  Add person
                </Button>
              </div>
              {companions.length === 0 ? (
                <p className="text-sm text-muted">No companions added — you can skip this.</p>
              ) : (
                <div className="space-y-3">
                  {companions.map((c, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-xl bg-app p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <Field label="Name">
                        <Input
                          value={c.name}
                          onChange={(e) => updateCompanion(index, { name: e.target.value })}
                          placeholder="Full name"
                        />
                      </Field>
                      <Field label="CNIC (optional)">
                        <Input
                          value={c.cnic}
                          onChange={(e) => updateCompanion(index, { cnic: e.target.value })}
                        />
                      </Field>
                      <Field label="Relation (optional)">
                        <Input
                          value={c.relation}
                          onChange={(e) => updateCompanion(index, { relation: e.target.value })}
                          placeholder="Spouse, child…"
                        />
                      </Field>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="!px-2 text-red-600"
                          onClick={() => removeCompanion(index)}
                          aria-label="Remove companion"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="rounded-2xl border border-app p-4">
            <div className="mb-3 flex items-center gap-2">
              <IdCard className="h-4 w-4 text-[var(--accent)]" />
              <div>
                <p className="text-sm font-bold">CNIC picture (optional)</p>
                <p className="text-xs text-muted">Stored on Cloudinary for verification.</p>
              </div>
            </div>
            <input
              ref={cnicFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickCnic(e.target.files?.[0] ?? null)}
            />
            {cnicPreview || existingCnicUrl ? (
              <div className="flex flex-wrap items-end gap-3">
                <img
                  src={cnicPreview || existingCnicUrl || ""}
                  alt="CNIC preview"
                  className="h-28 w-44 rounded-xl border border-app object-cover"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => cnicFileRef.current?.click()}
                  >
                    Change
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onPickCnic(null);
                      setExistingCnicUrl(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => cnicFileRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-app bg-app px-4 py-8 text-muted transition hover:border-[var(--accent)]"
              >
                <ImagePlus className="h-7 w-7 opacity-50" />
                <span className="text-sm font-semibold">Upload CNIC photo</span>
              </button>
            )}
          </div>

          <Field label={t.common.notes}>
            <TextArea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Allergies, late arrival, special requests…"
              rows={2}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function stayFallbackNights(row: CheckInRecord) {
  if (row.nights) return row.nights;
  return calcRoomBill(row.nightlyRate || 0, row.checkInAt, row.checkOutAt).nights;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-app px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-semibold break-all">{value}</p>
    </div>
  );
}
