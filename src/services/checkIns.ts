import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { calcCheckoutBill, calcRoomBill } from "../lib/billing";
import type {
  CheckInCompanion,
  CheckInRecord,
  CheckInStatus,
  PaymentStatus,
  PaymentTiming,
} from "../types/checkIn";

export type {
  CheckInCompanion,
  CheckInRecord,
  CheckInStatus,
  PaymentStatus,
  PaymentTiming,
};

const checkoutLocks = new Set<string>();

function mapCheckIn(id: string, data: Record<string, unknown>): CheckInRecord {
  const companions = Array.isArray(data.companions)
    ? (data.companions as CheckInCompanion[]).map((c) => ({
        name: String(c.name ?? ""),
        cnic: c.cnic ? String(c.cnic) : undefined,
        phone: c.phone ? String(c.phone) : undefined,
        relation: c.relation ? String(c.relation) : undefined,
      }))
    : [];

  const nightlyRate = Number(data.nightlyRate ?? 0);
  const checkInAt = String(data.checkInAt ?? "");
  const checkOutAt = String(data.checkOutAt ?? "");
  const extraCharges = Number(data.extraCharges ?? 0);
  const computed =
    nightlyRate > 0 && checkInAt && checkOutAt
      ? calcRoomBill(nightlyRate, checkInAt, checkOutAt, extraCharges)
      : null;

  const paymentTiming =
    (data.paymentTiming as PaymentTiming) ||
    (data.paymentStatus === "paid" ? "paid_at_checkin" : "due_on_checkout");

  let paymentStatus = (data.paymentStatus as PaymentStatus) || "pending";
  if (!data.paymentStatus) {
    paymentStatus = paymentTiming === "paid_at_checkin" ? "paid" : "pending";
  }

  return {
    id,
    roomId: String(data.roomId ?? ""),
    roomNumber: String(data.roomNumber ?? ""),
    guestName: String(data.guestName ?? ""),
    phone: String(data.phone ?? ""),
    cnic: String(data.cnic ?? ""),
    nationality: String(data.nationality ?? ""),
    purpose: String(data.purpose ?? "leisure"),
    adults: Number(data.adults ?? 1),
    children: Number(data.children ?? 0),
    companions,
    checkInAt,
    checkOutAt,
    cnicImageUrl: data.cnicImageUrl ? String(data.cnicImageUrl) : null,
    notes: String(data.notes ?? ""),
    status: (data.status as CheckInStatus) || "checked_in",
    paymentTiming,
    paymentStatus,
    nightlyRate: computed?.nightlyRate ?? nightlyRate,
    nights: Number(data.nights ?? computed?.nights ?? 0),
    roomCharges: Number(data.roomCharges ?? computed?.roomCharges ?? 0),
    extraCharges,
    totalBill: Number(data.totalBill ?? computed?.totalBill ?? 0),
    checkedOutAt: data.checkedOutAt ? String(data.checkedOutAt) : null,
    checkoutMode: (data.checkoutMode as CheckInRecord["checkoutMode"]) ?? null,
    plannedCheckOutAt: data.plannedCheckOutAt
      ? String(data.plannedCheckOutAt)
      : String(data.checkOutAt ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

export function subscribeCheckIns(
  onData: (rows: CheckInRecord[]) => void,
): Unsubscribe {
  const q = query(collection(db, "checkIns"), orderBy("checkInAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapCheckIn(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

function normalizeCompanions(list: CheckInCompanion[]) {
  return list
    .map((c) => ({
      name: c.name.trim(),
      cnic: c.cnic?.trim() || undefined,
      phone: c.phone?.trim() || undefined,
      relation: c.relation?.trim() || undefined,
    }))
    .filter((c) => c.name.length > 0);
}

function paymentStatusForCreate(timing: PaymentTiming): PaymentStatus {
  return timing === "paid_at_checkin" ? "paid" : "pending";
}

function paymentStatusOnCheckout(
  timing: PaymentTiming,
  options?: { paymentReceived?: boolean },
): PaymentStatus {
  if (timing === "paid_at_checkin") return "paid";
  // Manual checkout: staff confirm cash received via checkbox (default paid).
  if (options?.paymentReceived === true) return "paid";
  if (options?.paymentReceived === false) return "due";
  // Automatic / unspecified: leave as due until staff settle it
  return "due";
}

export async function createCheckIn(input: {
  roomId: string;
  roomNumber: string;
  guestName: string;
  phone: string;
  cnic: string;
  nationality: string;
  purpose: string;
  adults: number;
  children: number;
  companions: CheckInCompanion[];
  checkInAt: string;
  checkOutAt: string;
  cnicImageUrl: string | null;
  notes: string;
  nightlyRate: number;
  extraCharges?: number;
  paymentTiming: PaymentTiming;
}) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to check in a guest.");
  }

  const companions = normalizeCompanions(input.companions);
  const bill = calcRoomBill(
    input.nightlyRate,
    input.checkInAt,
    input.checkOutAt,
    input.extraCharges ?? 0,
  );
  const paymentTiming = input.paymentTiming;
  const paymentStatus = paymentStatusForCreate(paymentTiming);

  const checkInRef = await addDoc(collection(db, "checkIns"), {
    roomId: input.roomId,
    roomNumber: input.roomNumber,
    guestName: input.guestName.trim(),
    phone: input.phone.trim(),
    cnic: input.cnic.trim(),
    nationality: input.nationality.trim() || "Pakistan",
    purpose: input.purpose,
    adults: input.adults,
    children: input.children,
    companions,
    checkInAt: input.checkInAt,
    checkOutAt: input.checkOutAt,
    plannedCheckOutAt: input.checkOutAt,
    cnicImageUrl: input.cnicImageUrl,
    notes: input.notes.trim(),
    status: "checked_in" satisfies CheckInStatus,
    paymentTiming,
    paymentStatus,
    nightlyRate: bill.nightlyRate,
    nights: bill.nights,
    roomCharges: bill.roomCharges,
    extraCharges: bill.extraCharges,
    totalBill: bill.totalBill,
    checkedOutAt: null,
    checkoutMode: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });

  await updateDoc(doc(db, "rooms", input.roomId), {
    status: "occupied",
    cleaningStatus: "clean",
    guest: {
      name: input.guestName.trim(),
      phone: input.phone.trim(),
      cnic: input.cnic.trim(),
      nationality: input.nationality.trim() || "Pakistan",
      adults: input.adults,
      children: input.children,
      companions,
      checkIn: input.checkInAt,
      checkOut: input.checkOutAt,
      cnicImageUrl: input.cnicImageUrl,
      checkInId: checkInRef.id,
      notes: input.notes.trim(),
    },
    booking: null,
    openOrders: 0,
    updatedAt: serverTimestamp(),
  });

  return checkInRef.id;
}

export async function updateCheckIn(
  id: string,
  input: {
    roomId: string;
    guestName: string;
    phone: string;
    cnic: string;
    nationality: string;
    purpose: string;
    adults: number;
    children: number;
    companions: CheckInCompanion[];
    checkInAt: string;
    checkOutAt: string;
    notes: string;
    nightlyRate: number;
    extraCharges?: number;
    cnicImageUrl?: string | null;
    paymentTiming?: PaymentTiming;
  },
) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to update a check-in.");
  }

  const companions = normalizeCompanions(input.companions);
  const bill = calcRoomBill(
    input.nightlyRate,
    input.checkInAt,
    input.checkOutAt,
    input.extraCharges ?? 0,
  );

  const patch: Record<string, unknown> = {
    guestName: input.guestName.trim(),
    phone: input.phone.trim(),
    cnic: input.cnic.trim(),
    nationality: input.nationality.trim() || "Pakistan",
    purpose: input.purpose,
    adults: input.adults,
    children: input.children,
    companions,
    checkInAt: input.checkInAt,
    checkOutAt: input.checkOutAt,
    plannedCheckOutAt: input.checkOutAt,
    notes: input.notes.trim(),
    ...(input.cnicImageUrl !== undefined ? { cnicImageUrl: input.cnicImageUrl } : {}),
    nightlyRate: bill.nightlyRate,
    nights: bill.nights,
    roomCharges: bill.roomCharges,
    extraCharges: bill.extraCharges,
    totalBill: bill.totalBill,
    updatedAt: serverTimestamp(),
  };

  if (input.paymentTiming) {
    patch.paymentTiming = input.paymentTiming;
    const existing = await getDoc(doc(db, "checkIns", id));
    const status = existing.data()?.status;
    if (status === "checked_in") {
      patch.paymentStatus = paymentStatusForCreate(input.paymentTiming);
    }
  }

  await updateDoc(doc(db, "checkIns", id), patch);

  await updateDoc(doc(db, "rooms", input.roomId), {
    guest: {
      name: input.guestName.trim(),
      phone: input.phone.trim(),
      cnic: input.cnic.trim(),
      nationality: input.nationality.trim() || "Pakistan",
      adults: input.adults,
      children: input.children,
      companions,
      checkIn: input.checkInAt,
      checkOut: input.checkOutAt,
      checkInId: id,
      notes: input.notes.trim(),
      ...(input.cnicImageUrl !== undefined ? { cnicImageUrl: input.cnicImageUrl } : {}),
    },
    updatedAt: serverTimestamp(),
  });
}

async function ensureCheckoutCleanTask(roomId: string, roomNumber: string) {
  const snap = await getDocs(
    query(collection(db, "housekeepingTasks"), where("roomId", "==", roomId)),
  );
  const hasOpen = snap.docs.some((d) => {
    const status = String(d.data().status ?? "");
    return status === "pending" || status === "in_progress";
  });
  if (hasOpen) return;

  const due = new Date();
  due.setHours(due.getHours() + 2);
  await addDoc(collection(db, "housekeepingTasks"), {
    roomId,
    roomNumber,
    type: "checkout_clean",
    priority: "high",
    status: "pending",
    assigneeId: null,
    assigneeName: null,
    dueAt: due.toISOString(),
    notes: "Auto-created after guest checkout",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
    completedAt: null,
  });
}

/** Manual or automatic checkout — frees room, marks dirty, settles payment & bill. */
export async function checkoutGuest(
  id: string,
  options?: {
    at?: string;
    mode?: "manual" | "automatic";
    /** When true, bill is marked paid at checkout (cash collected). */
    paymentReceived?: boolean;
  },
) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to check out a guest.");
  }
  if (checkoutLocks.has(id)) return null;
  checkoutLocks.add(id);

  try {
    const ref = doc(db, "checkIns", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Check-in not found.");
    const data = snap.data();
    if (data.status === "checked_out") return null;

    const mode = options?.mode ?? "manual";
    const checkInAt = String(data.checkInAt ?? "");
    const plannedOut = String(
      data.plannedCheckOutAt ?? data.checkOutAt ?? new Date().toISOString(),
    );
    // Manual = actual leave time (now). Automatic = planned check-out time.
    const actualOut =
      mode === "manual"
        ? (options?.at ?? new Date().toISOString())
        : (options?.at ?? plannedOut);

    const paymentTiming =
      (data.paymentTiming as PaymentTiming) || "due_on_checkout";
    const alreadyPaid =
      paymentTiming === "paid_at_checkin" || data.paymentStatus === "paid";
    const paymentReceived =
      alreadyPaid ||
      (mode === "manual"
        ? (options?.paymentReceived ?? true)
        : (options?.paymentReceived ?? false));
    const bill = calcCheckoutBill(
      Number(data.nightlyRate ?? 0),
      checkInAt,
      plannedOut,
      actualOut,
      Number(data.extraCharges ?? 0),
    );

    await updateDoc(ref, {
      status: "checked_out",
      checkOutAt: actualOut,
      plannedCheckOutAt: plannedOut,
      checkedOutAt: actualOut,
      checkoutMode: mode,
      paymentTiming,
      paymentStatus: paymentStatusOnCheckout(paymentTiming, { paymentReceived }),
      nights: bill.nights,
      roomCharges: bill.roomCharges,
      extraCharges: bill.extraCharges,
      totalBill: bill.totalBill,
      updatedAt: serverTimestamp(),
    });

    const roomId = String(data.roomId ?? "");
    const roomNumber = String(data.roomNumber ?? "");
    if (roomId) {
      const roomSnap = await getDoc(doc(db, "rooms", roomId));
      const existingBooking = roomSnap.data()?.booking as
        | { checkIn?: string; checkOut?: string; guestName?: string }
        | null
        | undefined;
      const bookingStart = existingBooking?.checkIn
        ? new Date(existingBooking.checkIn).getTime()
        : NaN;
      const keepFutureBooking =
        existingBooking &&
        !Number.isNaN(bookingStart) &&
        bookingStart >= Date.now() - 60_000;

      await updateDoc(doc(db, "rooms", roomId), {
        status: keepFutureBooking ? "reserved" : "available",
        guest: null,
        booking: keepFutureBooking ? existingBooking : null,
        cleaningStatus: "dirty",
        cleaningBy: null,
        openOrders: keepFutureBooking
          ? Math.max(1, Number(roomSnap.data()?.openOrders ?? 1))
          : 0,
        updatedAt: serverTimestamp(),
      });
      try {
        await ensureCheckoutCleanTask(roomId, roomNumber);
      } catch {
        // Task create is best-effort
      }
    }

    return {
      nights: bill.nights,
      totalBill: bill.totalBill,
      plannedNights: bill.plannedNights,
      plannedTotal: bill.plannedTotal,
      early: bill.early,
      roomNumber,
      guestName: String(data.guestName ?? ""),
    };
  } finally {
    checkoutLocks.delete(id);
  }
}

/**
 * Undo a mistaken check-in (not a real guest departure).
 * Clears the room without dirtying it or creating a checkout bill.
 * Restores a reserved booking on the room when one still exists for that room.
 */
export async function cancelCheckIn(id: string) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to cancel a check-in.");
  }

  const ref = doc(db, "checkIns", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Check-in not found.");
  const data = snap.data();
  if (data.status !== "checked_in") {
    throw new Error("Only an active check-in can be cancelled.");
  }

  const roomId = String(data.roomId ?? "");
  const roomNumber = String(data.roomNumber ?? "");
  const guestName = String(data.guestName ?? "");
  let restoredBooking: Record<string, unknown> | null = null;

  await updateDoc(ref, {
    status: "cancelled" satisfies CheckInStatus,
    updatedAt: serverTimestamp(),
    cancelledAt: serverTimestamp(),
    cancelledBy: auth.currentUser.uid,
  });

  if (roomId) {
    try {
      const bq = query(collection(db, "bookingRequests"), where("roomId", "==", roomId));
      const bsnap = await getDocs(bq);
      const match = bsnap.docs.find((d) => {
        const s = String(d.data().status ?? "");
        return s === "reserved" || s === "confirmed";
      });
      if (match) {
        const b = match.data();
        restoredBooking = {
          guestName: String(b.guestName ?? ""),
          phone: String(b.phone ?? ""),
          checkIn: String(b.checkInAt ?? ""),
          checkOut: String(b.checkOutAt ?? ""),
          source: String(b.channel ?? "booking"),
          status: "reserved",
          bookingRequestId: match.id,
        };
      }
    } catch {
      // Room still frees without booking restore
    }

    await updateDoc(doc(db, "rooms", roomId), {
      status: restoredBooking ? "reserved" : "available",
      guest: null,
      booking: restoredBooking,
      cleaningBy: null,
      openOrders: restoredBooking ? 1 : 0,
      updatedAt: serverTimestamp(),
    });
  }

  return { roomNumber, guestName, restoredReservation: Boolean(restoredBooking) };
}

/** Check out any in-house stays whose check-out date/time has passed. */
export async function processDueCheckouts(rows?: CheckInRecord[]) {
  const now = Date.now();
  let list = rows;
  if (!list) {
    const q = query(collection(db, "checkIns"), where("status", "==", "checked_in"));
    const snap = await getDocs(q);
    list = snap.docs.map((d) => mapCheckIn(d.id, d.data() as Record<string, unknown>));
  }
  const due = list.filter(
    (r) => r.status === "checked_in" && r.checkOutAt && new Date(r.checkOutAt).getTime() <= now,
  );
  for (const row of due) {
    try {
      await checkoutGuest(row.id, {
        at: row.checkOutAt,
        mode: "automatic",
      });
    } catch {
      // continue others
    }
  }
  return due.length;
}
