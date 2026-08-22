import {
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  browserLocalPersistence,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PERMISSIONS, type PermissionId } from "../config/permissions";
import { auth, authPersistenceReady, db } from "../config/firebase";
import { firstAllowedPath, makePermissionChecker } from "../lib/permissions";
import type { ManagedUserDoc } from "../services/userManagement";
import { AuthContext, type AuthClaims } from "./auth-context";

const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.id);

function clearLegacyIndexedDbAuth() {
  if (typeof indexedDB === "undefined") return;
  try {
    indexedDB.deleteDatabase("firebaseLocalStorageDb");
  } catch {
    // ignore
  }
}

function isAdminUser(claims: AuthClaims, profile: ManagedUserDoc | null, role: string | null) {
  return (
    claims.admin === true ||
    role === "admin" ||
    profile?.roleId === "admin" ||
    profile?.roleName?.toLowerCase() === "admin"
  );
}

async function loadProfile(uid: string, user: User, claims: AuthClaims): Promise<ManagedUserDoc> {
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) {
    return { id: snap.id, ...(snap.data() as Omit<ManagedUserDoc, "id">) };
  }
  const roleFromJwt = typeof claims.role === "string" ? claims.role : "admin";
  const adminClaim = claims.admin === true || roleFromJwt === "admin";
  return {
    id: uid,
    name: user.displayName || "Admin",
    username: (user.email ?? "admin").split("@")[0],
    phone: "",
    email: user.email ?? "",
    roleId: typeof claims.roleId === "string" ? claims.roleId : "admin",
    roleName: roleFromJwt,
    permissions: adminClaim ? ALL_PERMISSIONS : [],
    status: "active",
    lastActive: "Just now",
  };
}

function claimsFromToken(tokenClaims: Record<string, unknown>): AuthClaims {
  return {
    role: typeof tokenClaims.role === "string" ? tokenClaims.role : undefined,
    roleId: typeof tokenClaims.roleId === "string" ? tokenClaims.roleId : undefined,
    admin: tokenClaims.admin === true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ManagedUserDoc | null>(null);
  const [claims, setClaims] = useState<AuthClaims>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};

    clearLegacyIndexedDbAuth();

    void (async () => {
      try {
        await authPersistenceReady;
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        // ignore
      }
      if (cancelled) return;

      unsub = onAuthStateChanged(auth, async (next) => {
        if (!next) {
          setUser(null);
          setProfile(null);
          setClaims({});
          setLoading(false);
          return;
        }

        setLoading(true);
        setUser(next);
        try {
          const tokenResult = await next.getIdTokenResult(true);
          const nextClaims = claimsFromToken(tokenResult.claims as Record<string, unknown>);
          setClaims(nextClaims);
          const nextProfile = await loadProfile(next.uid, next, nextClaims);
          if (!cancelled) setProfile(nextProfile);
        } catch {
          if (!cancelled) {
            setProfile(null);
            setClaims({});
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      });
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const tokenResult = await cred.user.getIdTokenResult(true);
    const nextClaims = claimsFromToken(tokenResult.claims as Record<string, unknown>);
    const nextProfile = await loadProfile(cred.user.uid, cred.user, nextClaims);
    setUser(cred.user);
    setClaims(nextClaims);
    setProfile(nextProfile);
    setLoading(false);

    const role = nextClaims.role || nextProfile.roleName || null;
    const admin = isAdminUser(nextClaims, nextProfile, role);
    const perms = admin ? ALL_PERMISSIONS : ((nextProfile.permissions ?? []) as PermissionId[]);
    const check = makePermissionChecker(perms, admin);
    return firstAllowedPath(check) || "/";
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false) => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken(forceRefresh);
  }, []);

  const role = claims.role || profile?.roleName || null;
  const isAdmin = isAdminUser(claims, profile, role);

  const permissions = useMemo(() => {
    if (isAdmin) return ALL_PERMISSIONS;
    return (profile?.permissions ?? []) as PermissionId[];
  }, [isAdmin, profile?.permissions]);

  const hasPermission = useCallback(
    (permission: string) => makePermissionChecker(permissions, isAdmin)(permission),
    [isAdmin, permissions],
  );

  const defaultPath = useMemo(
    () => firstAllowedPath(hasPermission),
    [hasPermission],
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      claims,
      role,
      permissions,
      isAdmin,
      hasPermission,
      defaultPath,
      loading,
      login,
      logout,
      getIdToken,
    }),
    [
      user,
      profile,
      claims,
      role,
      permissions,
      isAdmin,
      hasPermission,
      defaultPath,
      loading,
      login,
      logout,
      getIdToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
