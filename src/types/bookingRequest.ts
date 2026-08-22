export type BookingRequestStatus =
  | "pending"
  | "confirmed"
  | "reserved"
  | "declined"
  | "cancelled"
  | "checked_in";

/** Pending or held for a room (blocks other bookings for that stay). */
export function isOpenBookingStatus(status: BookingRequestStatus) {
  return status === "pending" || status === "confirmed" || status === "reserved";
}

export type BookingChannel =
  | "walk_in"
  | "phone"
  | "whatsapp"
  | "website"
  | "other";

export interface BookingRequest {
  id: string;
  guestName: string;
  phone: string;
  cnic: string;
  nationality: string;
  adults: number;
  children: number;
  checkInAt: string;
  checkOutAt: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  nightlyRate: number;
  nights: number;
  totalBill: number;
  channel: BookingChannel;
  notes: string;
  status: BookingRequestStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  confirmedAt?: unknown;
  declinedAt?: unknown;
}

export const BOOKING_CHANNELS: { value: BookingChannel; label: string }[] = [
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
];
