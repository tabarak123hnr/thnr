import type { BookingRequest } from "../types/bookingRequest";
import type { CheckInRecord } from "../types/checkIn";
import type { HousekeepingTask } from "../types/housekeeping";
import type {
  OpsNotification,
  OpsNotificationSeverity,
} from "../types/notification";
import type { FoodOrder } from "../types/order";
import type { HotelRoom } from "../types/room";
import { formatRs } from "./utils";

function tsMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string" || typeof value === "number") {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return Number((value as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isSameDay(iso: string, now: Date) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return startOfDay(new Date(t)) === startOfDay(now);
}

const severityRank: Record<OpsNotificationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};

/**
 * Builds actionable ops alerts from live hotel + restaurant data.
 * Focused on what staff need to act on — not a full event log.
 */
export function buildOpsNotifications(input: {
  checkIns: CheckInRecord[];
  orders: FoodOrder[];
  tasks: HousekeepingTask[];
  bookings: BookingRequest[];
  rooms: HotelRoom[];
  now?: Date;
  rs?: string;
}): OpsNotification[] {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const rs = input.rs ?? "Rs";
  const out: OpsNotification[] = [];

  const inHouse = input.checkIns.filter((c) => c.status === "checked_in");
  const openTasks = input.tasks.filter((t) => t.status !== "done");
  const pendingOrders = input.orders.filter((o) => o.status === "pending");

  // —— Kitchen / orders ——
  for (const order of pendingOrders) {
    const placed = tsMs(order.createdAt) || nowMs;
    const waitMin = Math.max(0, Math.floor((nowMs - placed) / 60000));
    const late = waitMin >= 12;
    const unpaid = order.paymentStatus === "due";
    out.push({
      id: `order-pending-${order.id}`,
      category: "orders",
      severity: late ? "critical" : "warning",
      title: late
        ? `Kitchen late · ${order.token}`
        : `Active order · ${order.token}`,
      body: `Room ${order.roomNumber} · ${order.guestName} · ${order.items
        .map((i) => `${i.qty}× ${i.name}`)
        .slice(0, 3)
        .join(", ")}${order.items.length > 3 ? "…" : ""} · waiting ${waitMin}m${
        unpaid ? " · payment due" : " · paid"
      }`,
      href: "/orders",
      atMs: placed,
    });
  }

  // —— Overdue / departing check-outs ——
  for (const stay of inHouse) {
    const dueMs = new Date(stay.checkOutAt).getTime();
    if (Number.isNaN(dueMs)) continue;
    const minsPast = Math.floor((nowMs - dueMs) / 60000);
    if (minsPast >= 0) {
      out.push({
        id: `checkout-overdue-${stay.id}`,
        category: "checkout",
        severity: minsPast >= 60 ? "critical" : "warning",
        title: `Checkout overdue · Room ${stay.roomNumber}`,
        body: `${stay.guestName} still in-house · planned ${new Date(
          stay.checkOutAt,
        ).toLocaleString(undefined, {
          hour: "numeric",
          minute: "2-digit",
          day: "numeric",
          month: "short",
        })} · ${minsPast < 60 ? `${minsPast}m` : `${Math.floor(minsPast / 60)}h`} late${
          stay.balanceDue > 0
            ? ` · balance ${formatRs(stay.balanceDue, rs)}`
            : ""
        }`,
        href: "/check-in",
        atMs: dueMs,
      });
    } else if (dueMs - nowMs <= 4 * 60 * 60 * 1000) {
      const minsLeft = Math.max(1, Math.ceil((dueMs - nowMs) / 60000));
      out.push({
        id: `checkout-soon-${stay.id}`,
        category: "checkout",
        severity: "info",
        title: `Departing soon · Room ${stay.roomNumber}`,
        body: `${stay.guestName} · checkout in ~${
          minsLeft < 60 ? `${minsLeft}m` : `${Math.ceil(minsLeft / 60)}h`
        }${
          stay.balanceDue > 0
            ? ` · collect ${formatRs(stay.balanceDue, rs)}`
            : ""
        }`,
        href: "/check-in",
        atMs: dueMs - minsLeft * 60000,
      });
    }
  }

  // —— Arrivals today (bookings held / pending) ——
  for (const booking of input.bookings) {
    if (
      booking.status !== "pending" &&
      booking.status !== "confirmed" &&
      booking.status !== "reserved"
    ) {
      continue;
    }
    if (!isSameDay(booking.checkInAt, now)) continue;
    out.push({
      id: `arrival-${booking.id}`,
      category: "arrivals",
      severity: booking.status === "pending" ? "warning" : "info",
      title: `Arrival today · Room ${booking.roomNumber}`,
      body: `${booking.guestName} · ${booking.status === "pending" ? "needs confirmation" : booking.status} · ${new Date(
        booking.checkInAt,
      ).toLocaleString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })}`,
      href: "/booking-requests",
      atMs: tsMs(booking.createdAt) || new Date(booking.checkInAt).getTime(),
    });
  }

  // —— Booking requests waiting ——
  for (const booking of input.bookings) {
    if (booking.status !== "pending") continue;
    // Skip if already covered as today's arrival with pending (same id prefix different)
    if (isSameDay(booking.checkInAt, now)) continue;
    out.push({
      id: `booking-pending-${booking.id}`,
      category: "bookings",
      severity: "warning",
      title: `Booking pending · ${booking.guestName}`,
      body: `Room ${booking.roomNumber} · ${booking.nights} night(s) · ${new Date(
        booking.checkInAt,
      ).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })} → confirm or decline`,
      href: "/booking-requests",
      atMs: tsMs(booking.createdAt) || nowMs,
    });
  }

  // —— Housekeeping ——
  for (const task of openTasks) {
    const due = tsMs(task.dueAt) || nowMs;
    const overdue = due < nowMs && task.status === "pending";
    if (task.status === "pending" && !task.assigneeId) {
      out.push({
        id: `hk-unassigned-${task.id}`,
        category: "housekeeping",
        severity: overdue || task.priority === "high" ? "critical" : "warning",
        title: `Needs cleaner · Room ${task.roomNumber}`,
        body: `${task.type.replace(/_/g, " ")} · ${task.priority} priority · assign staff & dirty-room photo`,
        href: "/housekeeping",
        atMs: due,
      });
    } else if (task.status === "in_progress") {
      out.push({
        id: `hk-progress-${task.id}`,
        category: "housekeeping",
        severity: "info",
        title: `Cleaning now · Room ${task.roomNumber}`,
        body: `${task.assigneeName || "Staff"} · mark done when finished (optional clean photo)`,
        href: "/housekeeping",
        atMs: tsMs(task.updatedAt) || due,
      });
    } else if (task.status === "pending") {
      out.push({
        id: `hk-pending-${task.id}`,
        category: "housekeeping",
        severity: overdue ? "warning" : "info",
        title: `Cleaning queued · Room ${task.roomNumber}`,
        body: `${task.assigneeName || "Assigned"} · ${task.type.replace(/_/g, " ")}`,
        href: "/housekeeping",
        atMs: due,
      });
    }
  }

  // Dirty rooms with no open housekeeping task
  const roomsWithOpenTask = new Set(
    openTasks.map((t) => t.roomId).filter(Boolean),
  );
  for (const room of input.rooms) {
    if (room.cleaningStatus !== "dirty") continue;
    if (roomsWithOpenTask.has(room.id)) continue;
    out.push({
      id: `room-dirty-${room.id}`,
      category: "rooms",
      severity: "warning",
      title: `Dirty room · ${room.number}`,
      body: room.guest?.name
        ? `Still marked dirty · guest ${room.guest.name}`
        : "Needs a housekeeping task after checkout",
      href: "/housekeeping",
      atMs: tsMs(room.updatedAt) || nowMs,
    });
  }

  for (const room of input.rooms) {
    if (room.status !== "maintenance") continue;
    out.push({
      id: `room-maint-${room.id}`,
      category: "rooms",
      severity: "info",
      title: `Maintenance · Room ${room.number}`,
      body: "Room blocked — check-in and bookings disabled until cleared",
      href: "/rooms",
      atMs: tsMs(room.updatedAt) || nowMs,
    });
  }

  // —— Payments (in-house balance) ——
  for (const stay of inHouse) {
    const due = Math.max(0, Number(stay.balanceDue) || 0);
    if (due <= 0) continue;
    // Avoid duplicating pure overdue-checkout payment line if already critical overdue
    const checkoutDue = new Date(stay.checkOutAt).getTime();
    const overdueCheckout =
      !Number.isNaN(checkoutDue) && checkoutDue <= nowMs;
    if (overdueCheckout) continue;
    out.push({
      id: `pay-stay-${stay.id}`,
      category: "payments",
      severity: due >= (stay.totalBill || due) * 0.5 ? "warning" : "info",
      title: `Balance on stay · Room ${stay.roomNumber}`,
      body: `${stay.guestName} · ${formatRs(due, rs)} still due (paid ${formatRs(
        Math.max(0, stay.amountPaid || 0),
        rs,
      )})`,
      href: "/invoices",
      atMs: tsMs(stay.updatedAt) || nowMs,
    });
  }

  // Unpaid delivered food still on due (edge: delivered but payment due)
  for (const order of input.orders) {
    if (order.status !== "delivered" || order.paymentStatus !== "due") continue;
    const stayOpen = inHouse.some((c) => c.id === order.checkInId);
    if (!stayOpen) continue;
    out.push({
      id: `pay-food-${order.id}`,
      category: "payments",
      severity: "warning",
      title: `Food unpaid · ${order.token}`,
      body: `Room ${order.roomNumber} · ${formatRs(order.amount, rs)} delivered but still due`,
      href: "/invoices",
      atMs: tsMs(order.deliveredAt) || tsMs(order.updatedAt) || nowMs,
    });
  }

  return out.sort((a, b) => {
    const bySev = severityRank[a.severity] - severityRank[b.severity];
    if (bySev !== 0) return bySev;
    return b.atMs - a.atMs;
  });
}

export function formatNotificationAge(atMs: number, nowMs = Date.now()) {
  if (!atMs) return "";
  const mins = Math.max(0, Math.floor((nowMs - atMs) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
