/**
 * Seeds Firebase Auth admin + Firestore profile/role + JWT custom claims.
 * Usage: npm run seed:admin
 *
 * .env:
 *   VITE_FIREBASE_* , ADMIN_EMAIL, ADMIN_PASSWORD
 *
 * Recommended (bypasses Firestore rules + writes role into JWT):
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
 *
 * Download key: Firebase Console → Project settings → Service accounts → Generate new private key
 */
import { config as loadEnv } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
loadEnv({ path: resolve(root, ".env"), override: true });

const apiKey = process.env.VITE_FIREBASE_API_KEY;
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const email = process.env.ADMIN_EMAIL?.trim();
const password = process.env.ADMIN_PASSWORD;
const serviceAccountPathRaw = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

if (!apiKey || !projectId) {
  console.error("Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID in .env");
  process.exit(1);
}
if (!email || !password) {
  console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env");
  process.exit(1);
}
if (password.length < 6) {
  console.error("ADMIN_PASSWORD must be at least 6 characters.");
  process.exit(1);
}

const ROLE_ID = "admin";
const ROLE_NAME = "admin";

const ALL_PERMISSIONS = [
  "dashboard",
  "notifications",
  "rooms",
  "check_in",
  "bookings",
  "housekeeping",
  "compliance",
  "qr_cards",
  "counter",
  "orders",
  "menu",
  "accounts",
  "invoices",
  "employees",
  "guest_app",
  "user_management",
  "settings",
];

function resolveServiceAccountPath() {
  const candidates = [
    serviceAccountPathRaw ? resolve(root, serviceAccountPathRaw) : null,
    resolve(root, "serviceAccountKey.json"),
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

function toFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((v) => toFirestoreValue(v)) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, toFirestoreValue(v)]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)]),
  );
}

async function authRequest(path, body) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || "Auth request failed");
    err.code = data?.error?.message;
    throw err;
  }
  return data;
}

async function upsertDocRest(collection, docId, fields, idToken) {
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`,
  );
  Object.keys(fields).forEach((key) =>
    url.searchParams.append("updateMask.fieldPaths", key),
  );

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(fields) }),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail =
      data?.error?.message ||
      data?.error?.status ||
      JSON.stringify(data?.error || data);
    throw new Error(`Firestore ${collection}/${docId}: ${detail}`);
  }
}

async function seedWithAdminSdk(saPath) {
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

  if (!getApps().length) {
    const sa = JSON.parse(readFileSync(saPath, "utf8"));
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id || projectId,
    });
  }

  const authAdmin = getAuth();
  const db = getFirestore();

  let user;
  let created = false;
  try {
    user = await authAdmin.getUserByEmail(email);
    await authAdmin.updateUser(user.uid, {
      password,
      displayName: "Tabarak Admin",
    });
    console.log("Admin Auth user already exists:", user.uid);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    user = await authAdmin.createUser({
      email,
      password,
      displayName: "Tabarak Admin",
      emailVerified: true,
    });
    created = true;
    console.log("Created Firebase Auth user:", user.uid);
  }

  await authAdmin.setCustomUserClaims(user.uid, {
    role: ROLE_NAME,
    roleId: ROLE_ID,
    admin: true,
  });
  console.log('JWT custom claims set: { role: "admin", roleId: "admin", admin: true }');

  await db
    .collection("roles")
    .doc(ROLE_ID)
    .set(
      {
        name: ROLE_NAME,
        description: "Full system access",
        permissions: ALL_PERMISSIONS,
        system: true,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  console.log("Upserted Firestore roles/" + ROLE_ID);

  await db
    .collection("users")
    .doc(user.uid)
    .set(
      {
        name: "Tabarak Admin",
        username: "admin",
        phone: "",
        email,
        roleId: ROLE_ID,
        roleName: ROLE_NAME,
        permissions: ALL_PERMISSIONS,
        status: "active",
        lastActive: "Just now",
        isAdmin: true,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  console.log("Upserted Firestore users/" + user.uid);

  return created;
}

async function seedWithRestOnly() {
  let idToken;
  let localId;
  let created = false;

  try {
    const signedUp = await authRequest("signUp", {
      email,
      password,
      returnSecureToken: true,
    });
    idToken = signedUp.idToken;
    localId = signedUp.localId;
    created = true;
    console.log("Created Firebase Auth user:", localId);
  } catch (err) {
    if (err.code !== "EMAIL_EXISTS") throw err;
    const signedIn = await authRequest("signInWithPassword", {
      email,
      password,
      returnSecureToken: true,
    });
    idToken = signedIn.idToken;
    localId = signedIn.localId;
    console.log("Admin Auth user already exists:", localId);
  }

  await authRequest("update", {
    idToken,
    displayName: "Tabarak Admin",
    returnSecureToken: true,
  });

  await upsertDocRest(
    "roles",
    ROLE_ID,
    {
      name: ROLE_NAME,
      description: "Full system access",
      permissions: ALL_PERMISSIONS,
      system: true,
      createdAt: new Date().toISOString(),
    },
    idToken,
  );
  console.log("Upserted Firestore roles/" + ROLE_ID);

  await upsertDocRest(
    "users",
    localId,
    {
      name: "Tabarak Admin",
      username: "admin",
      phone: "",
      email,
      roleId: ROLE_ID,
      roleName: ROLE_NAME,
      permissions: ALL_PERMISSIONS,
      status: "active",
      lastActive: "Just now",
      isAdmin: true,
      createdAt: new Date().toISOString(),
    },
    idToken,
  );
  console.log("Upserted Firestore users/" + localId);

  console.warn(
    "\n⚠ JWT custom claims were NOT set (no service account). Role is only in Firestore.",
  );
  console.warn(
    "Add serviceAccountKey.json and re-run to put role: \"admin\" inside the ID token.\n",
  );

  return created;
}

async function main() {
  console.log("Seeding admin for", email);
  console.log("Role:", ROLE_NAME);

  const saPath = resolveServiceAccountPath();
  let created;

  if (saPath) {
    console.log("Using Admin SDK:", saPath);
    created = await seedWithAdminSdk(saPath);
  } else {
    console.log("No service account found — using REST (Firestore rules must allow auth writes).");
    console.log("For JWT role claims, add serviceAccountKey.json (see script header).\n");
    created = await seedWithRestOnly();
  }

  console.log("");
  console.log(created ? "Admin seeded successfully." : "Admin profile refreshed.");
  console.log("Login email:", email);
  console.log('JWT claim to expect after Admin SDK seed: role = "admin"');
}

main().catch((err) => {
  const message = err.message || String(err);
  console.error("\nSeed failed:", message);
  if (message.includes("CONFIGURATION_NOT_FOUND")) {
    console.error("\nEnable Email/Password in Firebase Authentication → Sign-in method.");
  } else if (/PERMISSION_DENIED|insufficient permissions/i.test(message)) {
    console.error(`
Firestore blocked the write. Fix ONE of these:

A) Preferred — add a service account (also sets JWT role claim):
   1. Console → Project settings → Service accounts → Generate new private key
   2. Save as THR/serviceAccountKey.json
   3. npm run seed:admin

B) Or open Firestore rules temporarily:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
`);
  } else if (/NOT_FOUND|does not exist/i.test(message)) {
    console.error("\nCreate a Firestore database first (Console → Firestore → Create database).");
  }
  process.exit(1);
});
