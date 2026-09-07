import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type {
  FeedbackCategory,
  FeedbackStatus,
  GuestFeedback,
} from "../types/feedback";

export type { FeedbackCategory, FeedbackStatus, GuestFeedback };

function mapFeedback(id: string, data: Record<string, unknown>): GuestFeedback {
  const rating = Math.min(5, Math.max(1, Math.round(Number(data.rating) || 1)));
  const status = (data.status as FeedbackStatus) || "new";
  const category = (data.category as FeedbackCategory) || "hotel";
  return {
    id,
    guestName: String(data.guestName ?? "").trim(),
    phone: String(data.phone ?? "").trim(),
    email: String(data.email ?? "").trim(),
    roomNumber: String(data.roomNumber ?? "").trim(),
    rating,
    category,
    message: String(data.message ?? "").trim(),
    status: ["new", "reviewed", "archived"].includes(status) ? status : "new",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/** Public — no auth required (guests submit via QR / form link). */
export async function submitGuestFeedback(input: {
  guestName: string;
  phone?: string;
  email?: string;
  roomNumber?: string;
  rating: number;
  category: FeedbackCategory;
  message: string;
}) {
  const guestName = input.guestName.trim();
  const message = input.message.trim();
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 0)));
  if (!guestName) throw new Error("Please enter your name.");
  if (!message) throw new Error("Please write your feedback.");
  if (rating < 1 || rating > 5) throw new Error("Please choose a rating from 1 to 5.");

  const ref = await addDoc(collection(db, "feedback"), {
    guestName,
    phone: (input.phone ?? "").trim(),
    email: (input.email ?? "").trim(),
    roomNumber: (input.roomNumber ?? "").trim(),
    rating,
    category: input.category,
    message,
    status: "new" satisfies FeedbackStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeFeedback(
  onData: (rows: GuestFeedback[]) => void,
): Unsubscribe {
  if (!auth.currentUser) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapFeedback(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await updateDoc(doc(db, "feedback", id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFeedback(id: string) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await deleteDoc(doc(db, "feedback", id));
}
