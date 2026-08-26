import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type {
  CleaningStatus,
  HotelRoom,
  HotelRoomStatus,
} from "../types/room";
import { ROOM_TYPES } from "../types/room";

export type { CleaningStatus, HotelRoom, HotelRoomStatus };

export function subscribeRooms(onData: (rooms: HotelRoom[]) => void): Unsubscribe {
  const q = query(collection(db, "rooms"), orderBy("number"));
  return onSnapshot(
    q,
    (snap) => {
      const rooms = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          number: String(data.number ?? ""),
          floor: Number(data.floor ?? 1),
          type: String(data.type ?? "Normal"),
          typeUr: data.typeUr ? String(data.typeUr) : undefined,
          rate: Number(data.rate ?? 0),
          capacity: Number(data.capacity ?? 2),
          beds: Number(data.beds ?? 1),
          description: String(data.description ?? ""),
          images: Array.isArray(data.images) ? data.images.map(String) : [],
          status: (data.status as HotelRoomStatus) || "available",
          cleaningStatus: (data.cleaningStatus as CleaningStatus) || "clean",
          cleanedBy: data.cleanedBy ? String(data.cleanedBy) : null,
          cleaningBy: data.cleaningBy ? String(data.cleaningBy) : null,
          lastCleanedAt: data.lastCleanedAt ?? null,
          guest: data.guest ?? null,
          booking: data.booking ?? null,
          openOrders: Number(data.openOrders ?? 0),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          createdBy: data.createdBy ? String(data.createdBy) : undefined,
        } satisfies HotelRoom;
      });
      onData(rooms);
    },
    () => onData([]),
  );
}

export async function createRoom(input: {
  number: string;
  floor: number;
  type: string;
  rate: number;
  capacity: number;
  beds: number;
  description: string;
  images: string[];
}) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to add rooms.");
  }

  const typeMeta = ROOM_TYPES.find((t) => t.value === input.type);

  const ref = await addDoc(collection(db, "rooms"), {
    number: input.number.trim(),
    floor: input.floor,
    type: input.type,
    typeUr: typeMeta?.labelUr ?? "",
    rate: input.rate,
    capacity: input.capacity,
    beds: input.beds,
    description: input.description.trim(),
    images: input.images,
    status: "available" satisfies HotelRoomStatus,
    cleaningStatus: "clean" satisfies CleaningStatus,
    cleanedBy: null,
    cleaningBy: null,
    lastCleanedAt: serverTimestamp(),
    guest: null,
    booking: null,
    openOrders: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });

  return ref.id;
}
