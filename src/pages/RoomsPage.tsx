import { BedDouble, CalendarPlus, ImagePlus, LogIn, LogOut, Plus, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, TextArea } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { calcCheckoutBill } from "../lib/billing";
import { uploadImagesToCloudinary } from "../lib/cloudinary";
import { cn, formatRs } from "../lib/utils";
import {
  subscribeBookingRequests,
  type BookingRequest,
} from "../services/bookingRequests";
import {
  checkoutGuest,
  subscribeCheckIns,
  type CheckInRecord,
} from "../services/checkIns";
import { createRoom, subscribeRooms, type HotelRoom, type HotelRoomStatus } from "../services/rooms";
import { confirmCurrentUserPassword } from "../services/userManagement";
import { isOpenBookingStatus } from "../types/bookingRequest";
import { ROOM_TYPES, type CleaningStatus } from "../types/room";

const statusTone: Record<HotelRoomStatus, "success" | "warning" | "gold" | "danger" | "info"> = {
  available: "success",
  occupied: "gold",
  cleaning: "warning",
  maintenance: "danger",
  reserved: "info",
};

const cleaningTone: Record<CleaningStatus, "success" | "warning" | "info"> = {
  clean: "success",
  dirty: "warning",
  cleaning_in_progress: "info",
};

const cleaningLabel: Record<CleaningStatus, string> = {
  clean: "Clean",
  dirty: "Dirty",
  cleaning_in_progress: "Cleaning in progress",
};

const statusLabel: Record<HotelRoomStatus, string> = {
  available: "Available",
  occupied: "Occupied / Booked",
  reserved: "Reserved",
  maintenance: "Maintenance",
  cleaning: "Cleaning",
};

function formatWhen(value: unknown) {
  if (!value) return "—";
  let date: Date | null = null;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const seconds = Number((value as { seconds: number }).seconds);
    if (!Number.isNaN(seconds)) date = new Date(seconds * 1000);
  } else if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) date = d;
  }
  if (!date) return typeof value === "string" ? value : "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Crop-fill so letterboxed uploads don't leave white bars in the card. */
function roomImageUrl(url: string, w = 640, h = 400) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (url.includes("/upload/c_fill")) return url;
  return url.replace("/upload/", `/upload/c_fill,g_auto,w_${w},h_${h},f_auto,q_auto/`);
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

type RoomFormState = {
  number: string;
  floor: string;
  type: string;
  rate: string;
  capacity: string;
  beds: string;
  description: string;
};

const emptyForm: RoomFormState = {
  number: "",
  floor: "1",
  type: ROOM_TYPES[0].value,
  rate: "6500",
  capacity: "2",
  beds: "1",
  description: "",
};

export function RoomsPage() {
  const { t, language } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | HotelRoomStatus>("all");
  const [cleaningFilter, setCleaningFilter] = useState<"all" | CleaningStatus>("all");

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPassword, setCheckoutPassword] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    const unsubRooms = subscribeRooms((next) => {
      setRooms(next);
      setSelectedId((prev) => {
        if (prev && next.some((r) => r.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
    });
    const unsubBookings = subscribeBookingRequests(setBookingRequests);
    const unsubCheckIns = subscribeCheckIns(setCheckIns);
    return () => {
      unsubRooms();
      unsubBookings();
      unsubCheckIns();
    };
  }, []);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const filtered = useMemo(() => {
    return rooms.filter((room) => {
      if (filter !== "all" && room.status !== filter) return false;
      if (cleaningFilter !== "all" && room.cleaningStatus !== cleaningFilter) return false;
      return true;
    });
  }, [rooms, filter, cleaningFilter]);

  const selected = rooms.find((r) => r.id === selectedId) ?? null;

  const selectedOpenBookings = useMemo(() => {
    if (!selected) return [];
    return bookingRequests.filter(
      (b) => b.roomId === selected.id && isOpenBookingStatus(b.status),
    );
  }, [bookingRequests, selected]);

  const openBookingsCount = selectedOpenBookings.length;
  const reservedRequest =
    selectedOpenBookings.find((b) => b.status === "reserved" || b.status === "confirmed") ??
    null;

  const activeCheckIn = useMemo(() => {
    if (!selected) return null;
    const byId = selected.guest?.checkInId
      ? checkIns.find((c) => c.id === selected.guest?.checkInId && c.status === "checked_in")
      : null;
    if (byId) return byId;
    return (
      checkIns.find((c) => c.roomId === selected.id && c.status === "checked_in") ?? null
    );
  }, [selected, checkIns]);

  const canCheckIn =
    Boolean(selected) &&
    selected!.status !== "maintenance" &&
    !selected!.guest &&
    (selected!.status === "available" ||
      selected!.status === "reserved" ||
      selected!.status === "cleaning");

  const canCheckOut = Boolean(selected && (selected.guest || activeCheckIn));

  const canBookingRequest =
    Boolean(selected) && selected!.status !== "maintenance";

  const checkoutPreview = useMemo(() => {
    if (!activeCheckIn) return null;
    return calcCheckoutBill(
      activeCheckIn.nightlyRate,
      activeCheckIn.checkInAt,
      activeCheckIn.plannedCheckOutAt || activeCheckIn.checkOutAt,
      new Date().toISOString(),
      activeCheckIn.extraCharges || 0,
    );
  }, [activeCheckIn]);

  function goCheckIn() {
    if (!selected || !canCheckIn) return;
    navigate("/check-in", {
      state: { openCreate: true, roomId: selected.id },
    });
  }

  function goBookingRequest() {
    if (!selected || !canBookingRequest) return;
    navigate("/booking-requests", {
      state: { openCreate: true, roomId: selected.id },
    });
  }

  function openCheckout() {
    if (!canCheckOut || !activeCheckIn) {
      toastError("Check-out unavailable", "No active check-in found for this room.");
      return;
    }
    setCheckoutPassword("");
    setCheckoutError(null);
    setCheckoutOpen(true);
  }

  function closeCheckout() {
    if (checkoutBusy) return;
    setCheckoutOpen(false);
    setCheckoutPassword("");
    setCheckoutError(null);
  }

  async function submitCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCheckIn) return;
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      await confirmCurrentUserPassword(checkoutPassword);
      const result = await checkoutGuest(activeCheckIn.id, {
        mode: "manual",
        at: new Date().toISOString(),
      });
      setCheckoutOpen(false);
      setCheckoutPassword("");
      toastSuccess(
        "Checked out",
        result
          ? `${result.guestName || "Guest"} · Room ${result.roomNumber} · ${formatRs(result.totalBill, t.common.rs)}`
          : "Guest checked out.",
      );
    } catch (err) {
      setCheckoutError(mapReauthError(err));
    } finally {
      setCheckoutBusy(false);
    }
  }

  function openAdd() {
    setForm(emptyForm);
    setImageFiles([]);
    setImagePreviews([]);
    setFormError(null);
    setAddOpen(true);
  }

  function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    const next = [...imageFiles, ...Array.from(files)].slice(0, 6);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImageFiles(next);
    setImagePreviews(next.map((f) => URL.createObjectURL(f)));
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!form.number.trim()) {
      setFormError("Room number is required.");
      return;
    }
    const rate = Number(form.rate);
    const floor = Number(form.floor);
    const capacity = Number(form.capacity);
    const beds = Number(form.beds);
    if (!rate || rate < 0) {
      setFormError("Enter a valid nightly rate.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const images =
        imageFiles.length > 0 ? await uploadImagesToCloudinary(imageFiles) : [];
      await createRoom({
        number: form.number,
        floor,
        type: form.type,
        rate,
        capacity,
        beds,
        description: form.description,
        images,
      });
      setAddOpen(false);
      toastSuccess("Room added", `Room ${form.number.trim()} is ready.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add room.";
      setFormError(message);
      toastError("Could not add room", message);
    } finally {
      setSaving(false);
    }
  }

  const bookedBy =
    selected?.guest?.name ||
    selected?.booking?.guestName ||
    null;

  return (
    <div>
      <PageHeader
        title={t.pages.roomsTitle}
        subtitle="Create rooms, upload photos, and track booking & cleaning status."
        actions={
          <>
            <div className="w-40 shrink-0">
              <FancySelect
                value={filter}
                onChange={(v) => setFilter(v as typeof filter)}
                options={[
                  { value: "all", label: "All statuses" },
                  ...((Object.keys(statusLabel) as HotelRoomStatus[]).map((s) => ({
                    value: s,
                    label: statusLabel[s],
                  })) as { value: string; label: string }[]),
                ]}
              />
            </div>
            <div className="w-44 shrink-0">
              <FancySelect
                value={cleaningFilter}
                onChange={(v) => setCleaningFilter(v as typeof cleaningFilter)}
                options={[
                  { value: "all", label: "All cleaning" },
                  { value: "clean", label: "Clean" },
                  { value: "dirty", label: "Dirty" },
                  { value: "cleaning_in_progress", label: "Cleaning in progress" },
                ]}
              />
            </div>
            <Button
              type="button"
              className="shrink-0 cursor-pointer"
              icon={<Plus className="h-4 w-4" />}
              onClick={openAdd}
            >
              Add room
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {filtered.length === 0 ? (
            <Card className="!p-8 sm:col-span-2 2xl:col-span-3 text-center">
              <BedDouble className="mx-auto h-10 w-10 text-[var(--accent)]" />
              <p className="mt-3 font-bold">No rooms yet</p>
              <p className="mt-1 text-sm text-muted">
                Add your first room to start check-ins and housekeeping.
              </p>
              <Button type="button" className="mt-4" onClick={openAdd}>
                Add room
              </Button>
            </Card>
          ) : (
            filtered.map((room) => (
              <div
                key={room.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(room.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(room.id);
                  }
                }}
                className={cn(
                  "group surface h-fit max-w-md cursor-pointer self-start overflow-hidden rounded-2xl outline-none transition duration-200",
                  "hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.28)]",
                  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                  selectedId === room.id
                    ? "ring-2 ring-[var(--accent)]"
                    : "hover:ring-1 hover:ring-[color-mix(in_oklab,var(--accent)_55%,transparent)]",
                )}
                style={{ padding: 0, margin: 0 }}
              >
                <div
                  className="relative w-full overflow-hidden leading-[0]"
                  style={{ height: 176, margin: 0, padding: 0 }}
                >
                  {room.images[0] ? (
                    <img
                      src={roomImageUrl(room.images[0])}
                      alt={`Room ${room.number}`}
                      className="block h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.04]"
                      style={{ display: "block", margin: 0, padding: 0, border: 0 }}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[color-mix(in_oklab,var(--accent)_8%,var(--bg))] text-muted leading-normal">
                      <BedDouble className="h-10 w-10 opacity-35" />
                      <span className="text-xs font-semibold opacity-60">No photo</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-16 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute start-2.5 top-2.5 z-[2] leading-normal">
                    <Badge tone={statusTone[room.status]}>{statusLabel[room.status]}</Badge>
                  </div>
                  <span className="absolute bottom-2.5 end-2.5 z-[2] rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-extrabold leading-normal text-black shadow-sm">
                    {formatRs(room.rate, t.common.rs)}
                  </span>
                </div>
                <div className="border-t border-app p-3.5 leading-normal">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {t.common.floor} {room.floor}
                      </p>
                      <p className="mt-0.5 truncate text-lg font-extrabold leading-tight">
                        {t.common.room} {room.number}
                      </p>
                    </div>
                    <Badge tone={cleaningTone[room.cleaningStatus]}>
                      {cleaningLabel[room.cleaningStatus]}
                    </Badge>
                  </div>
                  <p className="mt-1.5 truncate text-sm text-muted">
                    {language === "ur" && room.typeUr ? room.typeUr : room.type}
                  </p>
                  <div className="mt-2.5">
                    {isRoomBooked(room) ? (
                      <Badge tone="success">Booked</Badge>
                    ) : (
                      <Badge tone="muted">Not booked</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <Card className="h-fit xl:sticky xl:top-20">
          {!selected ? (
            <div className="py-16 text-center text-sm text-muted">
              Select a room to see details.
            </div>
          ) : (
            <div className="space-y-5">
              {selected.images.length > 0 ? (
                <div>
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-app leading-[0]">
                    <img
                      src={roomImageUrl(selected.images[0], 960, 600)}
                      alt={`Room ${selected.number}`}
                      className="block h-full w-full object-cover object-center"
                      style={{ display: "block", margin: 0 }}
                    />
                  </div>
                  {selected.images.length > 1 ? (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {selected.images.slice(1, 5).map((src) => (
                        <div
                          key={src}
                          className="relative aspect-square overflow-hidden rounded-lg bg-app"
                        >
                          <img
                            src={src}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-app bg-app text-muted">
                  <ImagePlus className="h-8 w-8 opacity-40" />
                  <span className="text-xs font-semibold opacity-70">No photos yet</span>
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t.common.room} {selected.number}
                  </p>
                  <h2 className="text-lg font-extrabold">
                    {language === "ur" && selected.typeUr ? selected.typeUr : selected.type}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Floor {selected.floor} · {selected.beds} bed(s) · sleeps {selected.capacity}
                  </p>
                </div>
                <Badge tone={statusTone[selected.status]}>{statusLabel[selected.status]}</Badge>
              </div>

              {selected.description ? (
                <p className="text-sm leading-relaxed text-muted">{selected.description}</p>
              ) : null}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-app p-3">
                  <p className="text-xs text-muted">{t.common.rate}</p>
                  <p className="mt-1 font-bold">{formatRs(selected.rate, t.common.rs)}</p>
                </div>
                <div className="rounded-xl bg-app p-3">
                  <p className="text-xs text-muted">Open bookings</p>
                  <p className="mt-1 font-bold">{openBookingsCount}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Pending + reserved requests
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-app p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                  <p className="text-sm font-bold">Cleaning</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={cleaningTone[selected.cleaningStatus]}>
                    {cleaningLabel[selected.cleaningStatus]}
                  </Badge>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Who is cleaning</dt>
                    <dd className="font-semibold">
                      {selected.cleaningStatus === "cleaning_in_progress"
                        ? selected.cleaningBy || "Unassigned"
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Last cleaned by</dt>
                    <dd className="font-semibold">{selected.cleanedBy || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Last cleaned</dt>
                    <dd className="font-semibold">{formatWhen(selected.lastCleanedAt)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-app p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <UserRound className="h-4 w-4 text-[var(--accent)]" />
                  <p className="text-sm font-bold">Booking / guest</p>
                  {selected.status === "reserved" ||
                  selected.booking?.status === "reserved" ||
                  reservedRequest ? (
                    <Badge tone="info">Reserved</Badge>
                  ) : null}
                </div>
                {selected.status === "available" &&
                !selected.guest &&
                !selected.booking &&
                selectedOpenBookings.length === 0 ? (
                  <p className="text-sm text-muted">
                    Not booked. Guests appear after check-in; confirm a request to reserve this
                    room.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bookedBy || reservedRequest || selected.guest || selected.booking ? (
                      <div className="rounded-xl bg-app px-3 py-2.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                          {selected.guest
                            ? "Checked in"
                            : selected.booking || reservedRequest
                              ? "Reserved for"
                              : "Booked by"}
                        </p>
                        <p className="mt-1 font-bold">
                          {bookedBy || reservedRequest?.guestName || "—"}
                        </p>
                      </div>
                    ) : null}
                    {selected.guest ? (
                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        <Detail label={t.common.phone} value={selected.guest.phone} />
                        <Detail label={t.common.cnic} value={selected.guest.cnic || "—"} />
                        <Detail label={t.common.checkIn} value={formatWhen(selected.guest.checkIn)} />
                        <Detail label={t.common.checkOut} value={formatWhen(selected.guest.checkOut)} />
                        <Detail
                          label="Guests"
                          value={`${selected.guest.adults ?? 1} adults · ${selected.guest.children ?? 0} children`}
                        />
                        <Detail
                          label={t.common.nationality}
                          value={selected.guest.nationality || "—"}
                        />
                      </div>
                    ) : selected.booking || reservedRequest ? (
                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        <Detail
                          label={t.common.phone}
                          value={selected.booking?.phone || reservedRequest?.phone || "—"}
                        />
                        <Detail
                          label="Source"
                          value={
                            selected.booking?.source ||
                            reservedRequest?.channel ||
                            "—"
                          }
                        />
                        <Detail
                          label={t.common.checkIn}
                          value={formatWhen(
                            selected.booking?.checkIn || reservedRequest?.checkInAt,
                          )}
                        />
                        <Detail
                          label={t.common.checkOut}
                          value={formatWhen(
                            selected.booking?.checkOut || reservedRequest?.checkOutAt,
                          )}
                        />
                        <Detail label="Booking status" value="Reserved" />
                      </div>
                    ) : null}
                    {selected.guest?.notes ? (
                      <p className="rounded-xl bg-app px-3 py-2 text-sm text-muted">
                        {selected.guest.notes}
                      </p>
                    ) : null}
                    {selectedOpenBookings.length > 0 ? (
                      <div className="space-y-2 border-t border-app pt-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                          Open booking requests
                        </p>
                        {selectedOpenBookings.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-start justify-between gap-2 rounded-xl bg-app px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{b.guestName}</p>
                              <p className="text-xs text-muted">
                                {formatWhen(b.checkInAt)} → {formatWhen(b.checkOutAt)}
                              </p>
                            </div>
                            <Badge
                              tone={
                                b.status === "pending"
                                  ? "warning"
                                  : b.status === "reserved" || b.status === "confirmed"
                                    ? "info"
                                    : "muted"
                              }
                            >
                              {b.status === "pending" ? "Pending" : "Reserved"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {selected.status !== "maintenance" ? (
                <div className="rounded-2xl border border-app p-4">
                  <p className="mb-3 text-sm font-bold">Quick actions</p>
                  <div className="flex flex-col gap-2">
                    {canCheckIn ? (
                      <Button
                        type="button"
                        className="w-full cursor-pointer justify-center"
                        icon={<LogIn className="h-4 w-4" />}
                        onClick={goCheckIn}
                      >
                        {selected.status === "reserved" || reservedRequest
                          ? "Check in reserved guest"
                          : "Check in"}
                      </Button>
                    ) : null}
                    {canCheckOut ? (
                      <Button
                        type="button"
                        variant="danger"
                        className="w-full cursor-pointer justify-center"
                        icon={<LogOut className="h-4 w-4" />}
                        onClick={openCheckout}
                      >
                        Check out
                      </Button>
                    ) : null}
                    {canBookingRequest ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full cursor-pointer justify-center"
                        icon={<CalendarPlus className="h-4 w-4" />}
                        onClick={goBookingRequest}
                      >
                        New booking request
                      </Button>
                    ) : null}
                    {!canCheckIn && !canCheckOut && !canBookingRequest ? (
                      <p className="text-sm text-muted">No actions for this room status.</p>
                    ) : null}
                  </div>
                  {canCheckIn && selected.status === "reserved" ? (
                    <p className="mt-2 text-xs text-muted">
                      Room is reserved — check-in will open with this room and guest details
                      prefilled when available.
                    </p>
                  ) : null}
                  {canCheckOut && !canCheckIn ? (
                    <p className="mt-2 text-xs text-muted">
                      Guest is in-house. Check-out frees the room and marks it dirty for
                      housekeeping.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-app px-4 py-3 text-sm text-muted">
                  Room is under maintenance — check-in and booking are disabled.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={checkoutOpen}
        onClose={closeCheckout}
        title="Confirm check-out"
        subtitle={
          activeCheckIn
            ? `${activeCheckIn.guestName} · Room ${activeCheckIn.roomNumber}`
            : undefined
        }
        footer={
          <>
            <Button type="button" variant="secondary" disabled={checkoutBusy} onClick={closeCheckout}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="room-checkout-form"
              variant="danger"
              disabled={checkoutBusy || !checkoutPassword}
            >
              {checkoutBusy ? "Checking out…" : "Check out"}
            </Button>
          </>
        }
      >
        <form id="room-checkout-form" className="space-y-4" onSubmit={(e) => void submitCheckout(e)}>
          {checkoutPreview ? (
            <div className="rounded-2xl border border-app bg-app px-4 py-3 text-sm">
              {checkoutPreview.early ? (
                <>
                  <p className="text-muted">
                    Planned: {checkoutPreview.plannedNights} night(s) (
                    {formatRs(checkoutPreview.plannedTotal, t.common.rs)})
                  </p>
                  <p className="mt-1 font-bold">
                    Early leave bill: {checkoutPreview.nights} night(s) (
                    {formatRs(checkoutPreview.totalBill, t.common.rs)})
                  </p>
                </>
              ) : (
                <p className="font-bold">
                  Bill: {checkoutPreview.nights} night(s) ·{" "}
                  {formatRs(checkoutPreview.totalBill, t.common.rs)}
                </p>
              )}
            </div>
          ) : null}
          <Field label="Your password">
            <Input
              type="password"
              autoFocus
              required
              value={checkoutPassword}
              onChange={(e) => setCheckoutPassword(e.target.value)}
              placeholder="Confirm with your password"
            />
          </Field>
          {checkoutError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {checkoutError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => !saving && setAddOpen(false)}
        title="Add room"
        subtitle="Create a room with photos stored on Cloudinary."
        wide
        footer={
          <>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setAddOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="add-room-form" disabled={saving}>
              {saving ? "Saving…" : "Save room"}
            </Button>
          </>
        }
      >
        <form id="add-room-form" className="space-y-4" onSubmit={submitRoom}>
          {formError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Room number">
              <Input
                required
                value={form.number}
                onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
                placeholder="e.g. 101"
              />
            </Field>
            <Field label={t.common.floor}>
              <Input
                required
                type="number"
                min={0}
                value={form.floor}
                onChange={(e) => setForm((p) => ({ ...p, floor: e.target.value }))}
              />
            </Field>
            <SelectField label={t.common.type}>
              <FancySelect
                value={form.type}
                onChange={(type) => setForm((p) => ({ ...p, type }))}
                options={ROOM_TYPES.map((rt) => ({
                  value: rt.value,
                  label: language === "ur" ? rt.labelUr : rt.label,
                }))}
              />
            </SelectField>
            <Field label={t.common.rate}>
              <Input
                required
                type="number"
                min={0}
                value={form.rate}
                onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))}
              />
            </Field>
            <Field label="Capacity (guests)">
              <Input
                required
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
              />
            </Field>
            <Field label="Beds">
              <Input
                required
                type="number"
                min={1}
                value={form.beds}
                onChange={(e) => setForm((p) => ({ ...p, beds: e.target.value }))}
              />
            </Field>
          </div>

          <Field label={t.common.notes}>
            <TextArea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="View, amenities, smoking policy…"
              rows={2}
            />
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">Room pictures</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                onPickImages(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-app bg-app px-4 py-8 text-sm transition hover:border-[var(--accent)] hover:bg-accent-soft"
            >
              <ImagePlus className="h-7 w-7 text-[var(--accent)]" />
              <span className="font-semibold">Upload photos</span>
              <span className="text-xs text-muted">Up to 6 images · Cloudinary · max 8 MB each</span>
            </button>
            {imagePreviews.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {imagePreviews.map((src, i) => (
                  <div key={src} className="relative aspect-square overflow-hidden rounded-xl">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute end-1 top-1 cursor-pointer rounded-full bg-black/65 p-1 text-white"
                      onClick={() => removeImage(i)}
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </form>
      </Modal>
    </div>
  );
}

function isRoomBooked(room: HotelRoom) {
  return Boolean(
    room.guest?.name ||
      room.booking?.guestName ||
      room.status === "occupied" ||
      room.status === "reserved",
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
