import { Check, Eye, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, TextArea } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { calcRoomBill } from "../lib/billing";
import {
  listRoomAvailabilityForDates,
} from "../lib/roomAvailability";
import { formatRs } from "../lib/utils";
import {
  confirmBookingRequest,
  createBookingRequest,
  declineBookingRequest,
  subscribeBookingRequests,
  type BookingChannel,
  type BookingRequest,
  type BookingRequestStatus,
} from "../services/bookingRequests";
import { subscribeRooms, type HotelRoom } from "../services/rooms";
import { BOOKING_CHANNELS } from "../types/bookingRequest";

const statusTone: Record<
  BookingRequestStatus,
  "warning" | "success" | "danger" | "muted" | "info"
> = {
  pending: "warning",
  confirmed: "success",
  reserved: "info",
  declined: "danger",
  cancelled: "muted",
  checked_in: "info",
};

const statusLabel: Record<BookingRequestStatus, string> = {
  pending: "Pending",
  confirmed: "Reserved",
  reserved: "Reserved",
  declined: "Declined",
  cancelled: "Cancelled",
  checked_in: "Checked in",
};

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultCheckIn() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  return toLocalInputValue(d);
}

function defaultCheckOut() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(12, 0, 0, 0);
  return toLocalInputValue(d);
}

/** Next calendar day at 12:00 from a datetime-local value. */
function checkoutAfterCheckIn(checkInLocal: string) {
  const d = new Date(checkInLocal);
  if (Number.isNaN(d.getTime())) return defaultCheckOut();
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return toLocalInputValue(d);
}

function localToIso(local: string) {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
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

const emptyForm = () => ({
  guestName: "",
  phone: "",
  cnic: "",
  nationality: "Pakistan",
  adults: "1",
  children: "0",
  checkInAt: defaultCheckIn(),
  checkOutAt: defaultCheckOut(),
  roomId: "",
  channel: "phone" as BookingChannel,
  notes: "",
});

export function BookingRequestsPage() {
  const { t, language } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [filter, setFilter] = useState<"pending" | "reserved" | "all" | "declined">(
    "all",
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [viewRow, setViewRow] = useState<BookingRequest | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [preferRoomId, setPreferRoomId] = useState<string | null>(null);

  useEffect(() => {
    const a = subscribeBookingRequests(setBookings);
    const b = subscribeRooms(setRooms);
    return () => {
      a();
      b();
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return bookings;
    if (filter === "reserved") {
      return bookings.filter((b) => b.status === "reserved" || b.status === "confirmed");
    }
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  const checkInIso = useMemo(() => localToIso(form.checkInAt), [form.checkInAt]);
  const checkOutIso = useMemo(() => localToIso(form.checkOutAt), [form.checkOutAt]);

  const stayRangeValid =
    Boolean(checkInIso && checkOutIso) &&
    new Date(checkOutIso).getTime() > new Date(checkInIso).getTime();

  const availabilityForDates = useMemo(() => {
    if (!stayRangeValid) return [];
    return listRoomAvailabilityForDates(rooms, checkInIso, checkOutIso, bookings);
  }, [rooms, checkInIso, checkOutIso, bookings, stayRangeValid]);

  const availableForDates = useMemo(
    () => availabilityForDates.filter((a) => a.available),
    [availabilityForDates],
  );

  const selectedRoom = rooms.find((r) => r.id === form.roomId) ?? null;

  const liveBill = useMemo(() => {
    if (!selectedRoom || !checkInIso || !checkOutIso) {
      return { nights: 0, totalBill: 0, nightlyRate: 0 };
    }
    return calcRoomBill(selectedRoom.rate, checkInIso, checkOutIso);
  }, [selectedRoom, checkInIso, checkOutIso]);

  // Clear room if it becomes unavailable when dates change
  useEffect(() => {
    if (!form.roomId) return;
    if (preferRoomId && form.roomId === preferRoomId) {
      // Keep preferred room until it appears in the free list (or user changes dates)
      if (availableForDates.some((a) => a.room.id === form.roomId)) {
        setPreferRoomId(null);
      }
      return;
    }
    if (!availableForDates.some((a) => a.room.id === form.roomId)) {
      setForm((p) => ({ ...p, roomId: "" }));
    }
  }, [availableForDates, form.roomId, preferRoomId]);

  function datesAfterRoomFrees(room: HotelRoom) {
    const freeAtRaw = room.guest?.checkOut || room.booking?.checkOut;
    if (!freeAtRaw) {
      return { checkInAt: defaultCheckIn(), checkOutAt: defaultCheckOut() };
    }
    const freeAt = new Date(freeAtRaw);
    if (Number.isNaN(freeAt.getTime())) {
      return { checkInAt: defaultCheckIn(), checkOutAt: defaultCheckOut() };
    }
    // Start at the moment the room frees (half-open availability)
    const checkInAt = toLocalInputValue(freeAt);
    const out = new Date(freeAt);
    out.setDate(out.getDate() + 1);
    out.setHours(12, 0, 0, 0);
    return { checkInAt, checkOutAt: toLocalInputValue(out) };
  }

  function openCreate() {
    setPreferRoomId(null);
    setForm(emptyForm());
    setFormError(null);
    setCreateOpen(true);
  }

  function openCreateForRoom(roomId: string) {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      openCreate();
      return;
    }
    if (room.status === "maintenance") {
      toastError("Unavailable", "This room is under maintenance.");
      return;
    }
    const dates = datesAfterRoomFrees(room);
    setPreferRoomId(roomId);
    setForm({
      ...emptyForm(),
      ...dates,
      roomId,
    });
    setFormError(null);
    setCreateOpen(true);
  }

  useEffect(() => {
    const state = location.state as { openCreate?: boolean; roomId?: string } | null;
    if (!state?.openCreate || !rooms.length) return;
    if (state.roomId) openCreateForRoom(state.roomId);
    else openCreate();
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, location.key]);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.guestName.trim()) {
      setFormError("Guest name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setFormError("Phone is required.");
      return;
    }
    if (!checkInIso || !checkOutIso) {
      setFormError("Check-in and check-out date & time are required.");
      return;
    }
    if (new Date(checkOutIso) <= new Date(checkInIso)) {
      setFormError("Check-out must be after check-in.");
      return;
    }
    const avail = availableForDates.find((a) => a.room.id === form.roomId);
    if (!avail) {
      setFormError("Select a room that is free for these dates.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await createBookingRequest({
        guestName: form.guestName,
        phone: form.phone,
        cnic: form.cnic,
        nationality: form.nationality,
        adults: Math.max(1, Number(form.adults) || 1),
        children: Math.max(0, Number(form.children) || 0),
        checkInAt: checkInIso,
        checkOutAt: checkOutIso,
        roomId: avail.room.id,
        roomNumber: avail.room.number,
        roomType: avail.room.type,
        nightlyRate: avail.room.rate,
        channel: form.channel,
        notes: form.notes,
      });
      setCreateOpen(false);
      setPreferRoomId(null);
      toastSuccess(
        "Request created",
        `${form.guestName.trim()} · Room ${avail.room.number}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create request.";
      setFormError(message);
      toastError("Failed", message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm(row: BookingRequest) {
    setActingId(row.id);
    try {
      await confirmBookingRequest(row.id);
      toastSuccess("Reserved", `Room ${row.roomNumber} reserved for ${row.guestName}`);
      setViewRow((prev) => (prev?.id === row.id ? null : prev));
    } catch (err) {
      toastError(
        "Confirm failed",
        err instanceof Error ? err.message : "Could not confirm.",
      );
    } finally {
      setActingId(null);
    }
  }

  async function handleDecline(row: BookingRequest) {
    setActingId(row.id);
    try {
      await declineBookingRequest(row.id);
      toastSuccess("Declined", row.guestName);
      setViewRow((prev) => (prev?.id === row.id ? null : prev));
    } catch (err) {
      toastError(
        "Decline failed",
        err instanceof Error ? err.message : "Could not decline.",
      );
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.bookingsTitle}
        subtitle="Requests by date — rooms show if free for the stay, even if occupied now."
        actions={
          <>
            <div className="w-40 shrink-0">
              <FancySelect
                value={filter}
                onChange={(v) => setFilter(v as typeof filter)}
                options={[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Pending" },
                  { value: "reserved", label: "Reserved" },
                  { value: "declined", label: "Declined" },
                ]}
              />
            </div>
            <Button
              type="button"
              className="shrink-0 cursor-pointer"
              icon={<Plus className="h-4 w-4" />}
              onClick={openCreate}
            >
              New request
            </Button>
          </>
        }
      />

      <Card>
        <Table
          headers={[
            t.common.guest,
            t.common.room,
            "Stay",
            "Nights",
            "Bill",
            "Channel",
            t.status,
            t.common.actions,
          ]}
          colWidths={["16%", "10%", "22%", "8%", "12%", "10%", "10%", "12%"]}
        >
          {filtered.length === 0 ? (
            <Tr>
              <Td className="text-muted" colSpan={8}>
                No booking requests yet. Create one with preferred dates to see matching rooms.
              </Td>
            </Tr>
          ) : (
            filtered.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <p className="font-semibold">{row.guestName}</p>
                  <p className="text-xs text-muted">{row.phone}</p>
                </Td>
                <Td className="font-semibold">
                  {row.roomNumber}
                  <p className="text-xs font-normal text-muted">{row.roomType}</p>
                </Td>
                <Td className="text-xs">
                  <div>{formatDateTime(row.checkInAt)}</div>
                  <div className="text-muted">→ {formatDateTime(row.checkOutAt)}</div>
                </Td>
                <Td className="font-semibold">{row.nights}</Td>
                <Td className="font-extrabold text-[var(--accent)]">
                  {formatRs(row.totalBill, t.common.rs)}
                </Td>
                <Td>
                  <Badge tone="muted">
                    {BOOKING_CHANNELS.find((c) => c.value === row.channel)?.label ??
                      row.channel}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      className="cursor-pointer !bg-sky-600 !text-white hover:!opacity-90"
                      icon={<Eye className="h-3.5 w-3.5" />}
                      onClick={() => setViewRow(row)}
                    >
                      View
                    </Button>
                    {row.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="gold"
                          className="cursor-pointer"
                          icon={<Check className="h-3.5 w-3.5" />}
                          disabled={actingId === row.id}
                          onClick={() => void handleConfirm(row)}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="cursor-pointer text-red-600"
                          icon={<X className="h-3.5 w-3.5" />}
                          disabled={actingId === row.id}
                          onClick={() => void handleDecline(row)}
                        >
                          Decline
                        </Button>
                      </>
                    ) : null}
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
        title="Booking request"
        subtitle={viewRow ? `Room ${viewRow.roomNumber}` : undefined}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setViewRow(null)}>
              Close
            </Button>
            {viewRow?.status === "pending" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600"
                  disabled={actingId === viewRow.id}
                  onClick={() => void handleDecline(viewRow)}
                >
                  Decline
                </Button>
                <Button
                  type="button"
                  variant="gold"
                  disabled={actingId === viewRow.id}
                  onClick={() => void handleConfirm(viewRow)}
                >
                  Confirm
                </Button>
              </>
            ) : null}
          </>
        }
      >
        {viewRow ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label={t.common.name} value={viewRow.guestName} />
            <Detail label={t.common.phone} value={viewRow.phone} />
            <Detail label={t.common.cnic} value={viewRow.cnic || "—"} />
            <Detail label={t.common.nationality} value={viewRow.nationality || "—"} />
            <Detail label={t.common.room} value={`${viewRow.roomNumber} · ${viewRow.roomType}`} />
            <Detail label={t.status} value={statusLabel[viewRow.status]} />
            <Detail label={t.common.checkIn} value={formatDateTime(viewRow.checkInAt)} />
            <Detail label={t.common.checkOut} value={formatDateTime(viewRow.checkOutAt)} />
            <Detail label="Nights" value={String(viewRow.nights)} />
            <Detail label="Bill" value={formatRs(viewRow.totalBill, t.common.rs)} />
            <Detail
              label="Channel"
              value={
                BOOKING_CHANNELS.find((c) => c.value === viewRow.channel)?.label ??
                viewRow.channel
              }
            />
            <Detail
              label="Guests"
              value={`${viewRow.adults} adults · ${viewRow.children} children`}
            />
            {viewRow.notes ? (
              <div className="sm:col-span-2">
                <Detail label={t.common.notes} value={viewRow.notes} />
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => {
          if (saving) return;
          setCreateOpen(false);
          setPreferRoomId(null);
        }}
        title="New booking request"
        subtitle="Pick dates first — only rooms free for that stay are listed (including rooms freeing after a current guest)."
        wide
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setCreateOpen(false);
                setPreferRoomId(null);
              }}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" form="booking-request-form" disabled={saving}>
              {saving ? "Saving…" : "Create request"}
            </Button>
          </>
        }
      >
        <form id="booking-request-form" className="space-y-5" onSubmit={submitCreate}>
          {formError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${t.common.checkIn} (date & time)`}>
              <Input
                required
                type="datetime-local"
                value={form.checkInAt}
                onChange={(e) => {
                  const checkInAt = e.target.value;
                  setForm((p) => {
                    const nextOut =
                      !p.checkOutAt ||
                      new Date(p.checkOutAt).getTime() <= new Date(checkInAt).getTime()
                        ? checkoutAfterCheckIn(checkInAt)
                        : p.checkOutAt;
                    return { ...p, checkInAt, checkOutAt: nextOut };
                  });
                }}
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
          </div>

          <SelectField label={t.common.room}>
            <FancySelect
              value={form.roomId}
              onChange={(roomId) => setForm((p) => ({ ...p, roomId }))}
              disabled={!stayRangeValid}
              placeholder={
                !stayRangeValid
                  ? "Set check-out after check-in first"
                  : availableForDates.length
                    ? "Select a room free for these dates"
                    : "No rooms free for these dates"
              }
              options={availabilityForDates.map((a) => ({
                value: a.room.id,
                label: `Room ${a.room.number} · ${language === "ur" && a.room.typeUr ? a.room.typeUr : a.room.type} · ${formatRs(a.room.rate, t.common.rs)}/night`,
                description: a.label,
                disabled: !a.available,
              }))}
            />
          </SelectField>

          {!stayRangeValid && form.checkInAt && form.checkOutAt ? (
            <p className="rounded-xl bg-app px-3 py-2 text-sm text-muted">
              Check-out must be after check-in. When you move check-in forward, check-out is
              adjusted automatically so rooms that free up can appear.
            </p>
          ) : null}

          {stayRangeValid && availableForDates.length === 0 ? (
            <p className="rounded-xl bg-app px-3 py-2 text-sm text-muted">
              No rooms are free for this stay window. Occupied rooms appear once your check-in is
              on or after the time they become available (shown under each room).
            </p>
          ) : null}

          {liveBill.nightlyRate > 0 ? (
            <div className="rounded-2xl border border-[color-mix(in_oklab,var(--accent)_40%,var(--border))] bg-accent-soft px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
                Stay estimate
              </p>
              <p className="mt-1 text-sm text-muted">
                {liveBill.nights} night{liveBill.nights === 1 ? "" : "s"} ×{" "}
                {formatRs(liveBill.nightlyRate, t.common.rs)}
              </p>
              <p className="mt-1 text-xl font-extrabold text-[var(--accent)]">
                {formatRs(liveBill.totalBill, t.common.rs)}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.common.name}>
              <Input
                required
                value={form.guestName}
                onChange={(e) => setForm((p) => ({ ...p, guestName: e.target.value }))}
              />
            </Field>
            <Field label={t.common.phone}>
              <Input
                required
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </Field>
            <Field label={t.common.cnic}>
              <Input
                value={form.cnic}
                onChange={(e) => setForm((p) => ({ ...p, cnic: e.target.value }))}
              />
            </Field>
            <Field label={t.common.nationality}>
              <Input
                value={form.nationality}
                onChange={(e) => setForm((p) => ({ ...p, nationality: e.target.value }))}
              />
            </Field>
            <Field label={t.common.adults}>
              <Input
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
            <SelectField label="Channel">
              <FancySelect
                value={form.channel}
                onChange={(channel) =>
                  setForm((p) => ({ ...p, channel: channel as BookingChannel }))
                }
                options={BOOKING_CHANNELS.map((c) => ({
                  value: c.value,
                  label: c.label,
                }))}
              />
            </SelectField>
          </div>

          <Field label={t.common.notes}>
            <TextArea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Special requests…"
            />
          </Field>
        </form>
      </Modal>
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
