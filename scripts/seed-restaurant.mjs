/**
 * Seeds Firebase Auth + Firestore profile for restaurant POS login.
 * Email/password match src/config/restaurantAuth.ts
 *
 * Usage: node scripts/seed-restaurant.mjs
 * Needs: VITE_FIREBASE_* in .env and preferably FIREBASE_SERVICE_ACCOUNT_PATH
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
const email = "adminthnr@example.com";
const password = "adminhnr";
const serviceAccountPathRaw = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

if (!apiKey || !projectId) {
  console.error("Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID in .env");
  process.exit(1);
}

const ROLE_ID = "restaurant";
const ROLE_NAME = "restaurant";
const PERMISSIONS = ["counter", "orders", "menu", "notifications"];

function resolveServiceAccountPath() {
  const candidates = [
    serviceAccountPathRaw ? resolve(root, serviceAccountPathRaw) : null,
    resolve(root, "serviceAccountKey.json"),
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

async function signUpRest() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (data.error?.message === "EMAIL_EXISTS") {
    const signIn = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const signed = await signIn.json();
    if (!signIn.ok) {
      throw new Error(signed.error?.message || "Could not sign in existing restaurant user");
    }
    return signed;
  }
  if (!res.ok) throw new Error(data.error?.message || "signUp failed");
  return data;
}

async function upsertWithAdmin(uid) {
  const saPath = resolveServiceAccountPath();
  if (!saPath) {
    console.warn("No service account — skipping Firestore profile / claims. Auth user is ready.");
    return;
  }
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

  if (!getApps().length) {
    initializeApp({
      credential: cert(JSON.parse(readFileSync(saPath, "utf8"))),
      projectId,
    });
  }

  const auth = getAuth();
  const db = getFirestore();

  await auth.setCustomUserClaims(uid, {
    role: ROLE_NAME,
    roleId: ROLE_ID,
    admin: false,
  });

  await db.collection("roles").doc(ROLE_ID).set(
    {
      name: ROLE_NAME,
      description: "Restaurant parcel & delivery POS",
      permissions: PERMISSIONS,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await db.collection("users").doc(uid).set(
    {
      name: "Restaurant Admin",
      username: "adminthnr",
      phone: "",
      email,
      roleId: ROLE_ID,
      roleName: ROLE_NAME,
      permissions: PERMISSIONS,
      status: "active",
      lastActive: "Just now",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log("Firestore profile + custom claims written.");
}

const cred = await signUpRest();
console.log("Auth user ready:", email, "uid:", cred.localId);
await upsertWithAdmin(cred.localId);
console.log("Restaurant login:");
console.log("  email:", email);
console.log("  password:", password);
console.log("  opens: /restaurant/parcel");
