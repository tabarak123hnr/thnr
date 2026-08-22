import type { HotelRoom } from "../types/room";
import type { BookingRequest } from "../types/bookingRequest";

/** Parse ISO strings, Date, or Firestore Timestamp-like values. */
function toTime(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === "object") {
    const maybe = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybe.toDate === "function") {
      const t = maybe.toDate().getTime();
      return Number.isNaN(t) ? null : t;
    }
    if (typeof maybe.seconds === "number") {
      return maybe.seconds * 1000;
    }
  }
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** Half-open range overlap: [start, end) — room frees at end time. */
export function rangesOverlap(
  aStart: unknown,
  aEnd: unknown,
  bStart: unknown,
  bEnd: unknown,
) {
  const as = toTime(aStart);
  const ae = toTime(aEnd);
  const bs = toTime(bStart);
  const be = toTime(bEnd);
  if (as == null || ae == null || bs == null || be == null) return false;
  return as < be && bs < ae;
}

export type RoomAvailabilityReason =
  | "available"
  | "free_after_current_guest"
  | "maintenance"
  | "overlap_guest"
  | "overlap_booking"
  | "overlap_request";

export interface RoomAvailability {
  room: HotelRoom;
  available: boolean;
  reason: RoomAvailabilityReason;
  label: string;
  freeFrom?: string | null;
}

function asIsoString(value: unknown): string | null {
  const t = toTime(value);
  if (t == null) return null;
  return new Date(t).toISOString();
}

/**
 * Room is bookable for [checkIn, checkOut) if no stay/booking overlaps that window.
 * Currently occupied rooms still show as available when the guest leaves before the requested check-in.
 */
export function getRoomAvailabilityForDates(
  room: HotelRoom,
  checkIn: string,
  checkOut: string,
  confirmedBookings: BookingRequest[] = [],
  excludeBookingId?: string,
): RoomAvailability {
  if (room.status === "maintenance") {
    return {
      room,
      available: false,
      reason: "maintenance",
      label: "Maintenance",
    };
  }

  const guestIn = room.guest?.checkIn;
  const guestOut = room.guest?.checkOut;
  if (guestIn && guestOut) {
    if (rangesOverlap(checkIn, checkOut, guestIn, guestOut)) {
      const freeIso = asIsoString(guestOut);
      return {
        room,
        available: false,
        reason: "overlap_guest",
        label: `Occupied until ${formatShort(guestOut)}`,
        freeFrom: freeIso,
      };
    }
  }

  const bookIn = room.booking?.checkIn;
  const bookOut = room.booking?.checkOut;
  if (bookIn && bookOut) {
    if (rangesOverlap(checkIn, checkOut, bookIn, bookOut)) {
      return {
        room,
        available: false,
        reason: "overlap_booking",
        label: `Reserved ${formatShort(bookIn)} → ${formatShort(bookOut)}`,
      };
    }
  }

  for (const b of confirmedBookings) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (b.roomId !== room.id) continue;
    if (b.status !== "confirmed" && b.status !== "reserved" && b.status !== "pending") continue;
    if (rangesOverlap(checkIn, checkOut, b.checkInAt, b.checkOutAt)) {
      return {
        room,
        available: false,
        reason: "overlap_request",
        label:
          b.status === "reserved" || b.status === "confirmed"
            ? `Reserved ${formatShort(b.checkInAt)} → ${formatShort(b.checkOutAt)}`
            : `Pending request overlaps`,
      };
    }
  }

  const guestOutIso = asIsoString(guestOut);
  const checkInT = toTime(checkIn);
  const guestOutT = toTime(guestOut);
  const freeAfterGuest =
    Boolean(guestOutIso) &&
    checkInT != null &&
    guestOutT != null &&
    checkInT >= guestOutT &&
    (room.status === "occupied" || Boolean(room.guest));

  return {
    room,
    available: true,
    reason: freeAfterGuest ? "free_after_current_guest" : "available",
    label: freeAfterGuest
      ? `Free after ${formatShort(guestOut!)}`
      : room.status === "available"
        ? "Available now"
        : "Open for these dates",
    freeFrom: freeAfterGuest ? guestOutIso : null,
  };
}

export function listRoomAvailabilityForDates(
  rooms: HotelRoom[],
  checkIn: string,
  checkOut: string,
  bookings: BookingRequest[] = [],
  excludeBookingId?: string,
) {
  return rooms
    .map((room) =>
      getRoomAvailabilityForDates(room, checkIn, checkOut, bookings, excludeBookingId),
    )
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.room.number.localeCompare(b.room.number, undefined, { numeric: true });
    });
}

export function listAvailableRoomsForDates(
  rooms: HotelRoom[],
  checkIn: string,
  checkOut: string,
  bookings: BookingRequest[] = [],
  excludeBookingId?: string,
) {
  return listRoomAvailabilityForDates(
    rooms,
    checkIn,
    checkOut,
    bookings,
    excludeBookingId,
  ).filter((r) => r.available);
}

function formatShort(value: unknown) {
  const t = toTime(value);
  if (t == null) return String(value ?? "");
  return new Date(t).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
