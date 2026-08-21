import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, createSecondaryAuth, db } from "../config/firebase";
import type { PermissionId } from "../config/permissions";

export interface RoleDoc {
  id: string;
  name: string;
  description: string;
  permissions: PermissionId[];
  system?: boolean;
  createdAt?: unknown;
}

export interface ManagedUserDoc {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: PermissionId[];
  status: "active" | "invited" | "disabled";
  lastActive: string;
  createdAt?: unknown;
}

export function subscribeRoles(onData: (roles: RoleDoc[]) => void): Unsubscribe {
  const q = query(collection(db, "roles"), orderBy("name"));
  return onSnapshot(
    q,
    (snap) => {
      const roles = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoleDoc, "id">) }));
      onData(roles);
    },
    () => onData([]),
  );
}

export function subscribeUsers(onData: (users: ManagedUserDoc[]) => void): Unsubscribe {
  const q = query(collection(db, "users"), orderBy("name"));
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ManagedUserDoc, "id">),
      }));
      onData(users);
    },
    () => onData([]),
  );
}

export async function createRole(input: {
  name: string;
  description: string;
}) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to create roles.");
  }
  const ref = await addDoc(collection(db, "roles"), {
    name: input.name.trim(),
    description: input.description.trim(),
    permissions: [],
    system: false,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });
  return ref.id;
}

export async function createManagedUser(input: {
  name: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  roleId: string;
  roleName: string;
  permissions: PermissionId[];
}) {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to add users.");
  }

  const { auth: secondaryAuth, dispose } = createSecondaryAuth();
  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email.trim(),
      input.password,
    );
    await updateProfile(cred.user, { displayName: input.name.trim() });

    await setDoc(doc(db, "users", cred.user.uid), {
      name: input.name.trim(),
      username: input.username.trim().toLowerCase(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      roleId: input.roleId,
      roleName: input.roleName,
      permissions: input.permissions,
      status: "active",
      lastActive: "Just now",
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid,
    });

    await secondaryAuth.signOut();
    return cred.user.uid;
  } finally {
    await dispose();
  }
}
