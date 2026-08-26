export type HotelRoomStatus =
  | "available"
  | "occupied"
  | "reserved"
  | "maintenance"
  | "cleaning";

export type CleaningStatus = "clean" | "dirty" | "cleaning_in_progress";

export interface RoomGuestCompanion {
  name: string;
  cnic?: string;
  phone?: string;
  relation?: string;
}

export interface RoomGuestInfo {
  name: string;
  phone: string;
  cnic?: string;
  nationality?: string;
  adults?: number;
  children?: number;
  companions?: RoomGuestCompanion[];
  checkIn: string;
  checkOut: string;
  email?: string;
  cnicImageUrl?: string | null;
  cnicFrontImageUrl?: string | null;
  cnicBackImageUrl?: string | null;
  checkInId?: string;
  notes?: string;
}

export interface RoomBookingInfo {
  guestName: string;
  phone?: string;
  checkIn: string;
  checkOut: string;
  source?: string;
  status?: string;
  bookingRequestId?: string;
}

export interface HotelRoom {
  id: string;
  number: string;
  floor: number;
  type: string;
  typeUr?: string;
  rate: number;
  capacity: number;
  beds: number;
  description: string;
  images: string[];
  status: HotelRoomStatus;
  cleaningStatus: CleaningStatus;
  cleanedBy: string | null;
  cleaningBy: string | null;
  lastCleanedAt: unknown;
  guest: RoomGuestInfo | null;
  booking: RoomBookingInfo | null;
  openOrders: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}

export const ROOM_TYPES = [
  { value: "Normal", label: "Normal", labelUr: "نارمل" },
  { value: "Studio", label: "Studio", labelUr: "اسٹوڈیو" },
  { value: "VIP", label: "VIP", labelUr: "وی آئی پی" },
] as const;
