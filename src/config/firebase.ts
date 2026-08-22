import { initializeApp, deleteApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Force Auth session into localStorage (not IndexedDB).
 * IndexedDB persistence breaks some production / WebView / Safari flows.
 */
function createBrowserAuth(app: FirebaseApp) {
  try {
    return initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } catch {
    // Already initialized (Vite HMR) — reuse and re-assert persistence
    return getAuth(app);
  }
}

export const auth = createBrowserAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

/** Ensures every sign-in / restore uses localStorage. */
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch(
  () => undefined,
);

export const analytics =
  typeof window !== "undefined" ? getAnalytics(firebaseApp) : null;

/** Secondary app so creating a user does not sign out the current admin. */
export function createSecondaryAuth() {
  const name = `secondary-${Date.now()}`;
  const app = initializeApp(firebaseConfig, name);
  let secondaryAuth;
  try {
    secondaryAuth = initializeAuth(app, {
      persistence: inMemoryPersistence,
    });
  } catch {
    secondaryAuth = getAuth(app);
  }
  return {
    auth: secondaryAuth,
    dispose: async () => {
      await deleteApp(app);
    },
  };
}
