import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { calcRoomBill } from "../lib/billing";
import type {
  BookingChannel,
  BookingRequest,
  BookingRequestStatus,
} from "../types/bookingRequest";

export type { BookingChannel, BookingRequest, BookingRequestStatus };

function mapBooking(id: string, data: Record<string, unknown>): BookingRequest {
  return {
    id,
    guestName: String(data.guestName ?? ""),
    phone: String(data.phone ?? ""),
    cnic: String(data.cnic ?? ""),
    nationality: String(data.nationality ?? "Pakistan"),
    adults: Number(data.adults ?? 1),
    children: Number(data.children ?? 0),
    checkInAt: String(data.checkInAt ?? ""),
    checkOutAt: String(data.checkOutAt ?? ""),
    roomId: String(data.roomId ?? ""),
    roomNumber: String(data.roomNumber ?? ""),
    roomType: String(data.roomType ?? ""),
    nightlyRate: Number(data.nightlyRate ?? 0),
    nights: Number(data.nights ?? 0),
    totalBill: Number(data.totalBill ?? 0),
    channel: (data.channel as BookingChannel) || "phone",
    notes: String(data.notes ?? ""),
    status: (data.status as BookingRequestStatus) || "pending",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    confirmedAt: data.confirmedAt,
    declinedAt: data.declinedAt,
  };
}

export function subscribeBookingRequests(
  onData: (rows: BookingRequest[]) => void,
): Unsubscribe {
  const q = query(collection(db, "bookingRequests"), orderBy("checkInAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapBooking(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

export async function createBookingRequest(input: {
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
  channel: BookingChannel;
  notes: string;
}) {
  if (!auth.currentUser) throw new Error("You must be signed in.");

  const bill = calcRoomBill(
    input.nightlyRate,
    input.checkInAt,
    input.checkOutAt,
  );

  const ref = await addDoc(collection(db, "bookingRequests"), {
    guestName: input.guestName.trim(),
    phone: input.phone.trim(),
    cnic: input.cnic.trim(),
    nationality: input.nationality.trim() || "Pakistan",
    adults: input.adults,
    children: input.children,
    checkInAt: input.checkInAt,
    checkOutAt: input.checkOutAt,
    roomId: input.roomId,
    roomNumber: input.roomNumber,
    roomType: input.roomType,
    nightlyRate: bill.nightlyRate,
    nights: bill.nights,
    totalBill: bill.totalBill,
    channel: input.channel,
    notes: input.notes.trim(),
    status: "pending" satisfies BookingRequestStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    confirmedAt: null,
    declinedAt: null,
  });

  // Bump room open-bookings counter for the details panel
  try {
    const roomRef = doc(db, "rooms", input.roomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
      const current = Number(roomSnap.data().openOrders ?? 0);
      await updateDoc(roomRef, {
        openOrders: current + 1,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-fatal — UI also counts live from booking requests
  }

  return ref.id;
}

export async function confirmBookingRequest(id: string) {
  if (!auth.currentUser) throw new Error("You must be signed in.");

  const ref = doc(db, "bookingRequests", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Booking request not found.");
  const data = snap.data();
  if (data.status !== "pending") {
    throw new Error("Only pending requests can be confirmed.");
  }

  await updateDoc(ref, {
    status: "reserved" satisfies BookingRequestStatus,
    confirmedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const roomId = String(data.roomId ?? "");
  if (!roomId) return;

  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  const room = roomSnap.data();
  const hasGuest = Boolean(room?.guest);
  const checkInAt = String(data.checkInAt ?? "");
  const checkOutAt = String(data.checkOutAt ?? "");
  const openOrders = Number(room?.openOrders ?? 0);

  await updateDoc(doc(db, "rooms", roomId), {
    booking: {
      guestName: String(data.guestName ?? ""),
      phone: String(data.phone ?? ""),
      checkIn: checkInAt,
      checkOut: checkOutAt,
      source: String(data.channel ?? "booking"),
      status: "reserved",
      bookingRequestId: id,
    },
    // If empty now, mark reserved; if guest still in, stay occupied until they leave
    ...(hasGuest ? {} : { status: "reserved" }),
    // Keep at least 1 open booking while reserved
    openOrders: Math.max(1, openOrders),
    updatedAt: serverTimestamp(),
  });
}

export async function declineBookingRequest(id: string) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const ref = doc(db, "bookingRequests", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Booking request not found.");
  if (snap.data().status !== "pending") {
    throw new Error("Only pending requests can be declined.");
  }
  const data = snap.data();
  await updateDoc(ref, {
    status: "declined",
    declinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const roomId = String(data.roomId ?? "");
  if (!roomId) return;
  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
      const current = Number(roomSnap.data().openOrders ?? 0);
      await updateDoc(roomRef, {
        openOrders: Math.max(0, current - 1),
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-fatal
  }
}
