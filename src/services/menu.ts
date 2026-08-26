import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { MENU_CATEGORIES, type MenuItem } from "../types/menu";

export type { MenuItem };
export { MENU_CATEGORIES };

function resolveMenuCategory(category: string, categoryUr?: string) {
  const trimmed = category.trim();
  const found =
    MENU_CATEGORIES.find((c) => c.value === trimmed) ||
    MENU_CATEGORIES.find((c) => c.label.toLowerCase() === trimmed.toLowerCase()) ||
    MENU_CATEGORIES.find((c) => c.labelUr === trimmed) ||
    MENU_CATEGORIES[0];
  return {
    category: found.value,
    categoryUr: (categoryUr ?? "").trim() || found.labelUr,
  };
}

function mapItem(id: string, data: Record<string, unknown>): MenuItem {
  return {
    id,
    name: String(data.name ?? ""),
    nameUr: String(data.nameUr ?? ""),
    category: String(data.category ?? "Other"),
    categoryUr: String(data.categoryUr ?? ""),
    price: Math.max(0, Number(data.price) || 0),
    available: data.available !== false,
    prepMinutes: Math.max(0, Number(data.prepMinutes) || 0),
    description: data.description ? String(data.description) : "",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

export function subscribeMenuItems(onData: (rows: MenuItem[]) => void): Unsubscribe {
  const q = query(collection(db, "menuItems"), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapItem(d.id, d.data() as Record<string, unknown>)));
    },
    () => onData([]),
  );
}

export async function createMenuItem(input: {
  name: string;
  nameUr?: string;
  category: string;
  categoryUr?: string;
  price: number;
  available?: boolean;
  prepMinutes?: number;
  description?: string;
}) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to add a menu item.");
  }
  const name = input.name.trim();
  if (!name) throw new Error("Dish name is required.");
  if (!(input.price >= 0)) throw new Error("Price must be zero or more.");

  const cat = resolveMenuCategory(input.category || "", input.categoryUr);

  const ref = await addDoc(collection(db, "menuItems"), {
    name,
    nameUr: (input.nameUr ?? "").trim(),
    category: cat.category,
    categoryUr: cat.categoryUr,
    price: Number(input.price) || 0,
    available: input.available !== false,
    prepMinutes: Math.max(0, Math.floor(Number(input.prepMinutes) || 0)),
    description: (input.description ?? "").trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });
  return ref.id;
}

export async function updateMenuItem(
  id: string,
  input: {
    name: string;
    nameUr?: string;
    category: string;
    categoryUr?: string;
    price: number;
    available?: boolean;
    prepMinutes?: number;
    description?: string;
  },
) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to update a menu item.");
  }
  const name = input.name.trim();
  if (!name) throw new Error("Dish name is required.");

  const cat = resolveMenuCategory(input.category || "", input.categoryUr);

  await updateDoc(doc(db, "menuItems", id), {
    name,
    nameUr: (input.nameUr ?? "").trim(),
    category: cat.category,
    categoryUr: cat.categoryUr,
    price: Number(input.price) || 0,
    available: input.available !== false,
    prepMinutes: Math.max(0, Math.floor(Number(input.prepMinutes) || 0)),
    description: (input.description ?? "").trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function setMenuItemAvailable(id: string, available: boolean) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  await updateDoc(doc(db, "menuItems", id), {
    available,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMenuItem(id: string) {
  if (!auth.currentUser) throw new Error("You must be signed in to delete a menu item.");
  await deleteDoc(doc(db, "menuItems", id));
}

/** One-time seed when the menu collection is empty. */
export async function seedMenuIfEmpty(
  samples: {
    name: string;
    nameUr: string;
    category: string;
    categoryUr: string;
    price: number;
    available: boolean;
    prepMinutes: number;
  }[],
) {
  if (!auth.currentUser) throw new Error("You must be signed in.");
  const snap = await getDocs(collection(db, "menuItems"));
  if (!snap.empty) return { seeded: false, count: snap.size };

  let count = 0;
  for (const s of samples) {
    await createMenuItem(s);
    count += 1;
  }
  return { seeded: true, count };
}

/** Bulk-create dishes from an imported spreadsheet. */
export async function importMenuItems(
  rows: {
    name: string;
    nameUr?: string;
    category: string;
    categoryUr?: string;
    price: number;
    available?: boolean;
    prepMinutes?: number;
    description?: string;
  }[],
) {
  if (!auth.currentUser) throw new Error("You must be signed in to import the menu.");
  if (!rows.length) throw new Error("No dishes to import.");

  let imported = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      await createMenuItem(row);
      imported += 1;
    } catch (err) {
      errors.push(
        `${row.name || "(blank)"}: ${err instanceof Error ? err.message : "failed"}`,
      );
    }
  }

  return { imported, failed: errors.length, errors };
}
