import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PERMISSIONS, type PermissionId } from "../config/permissions";
import { auth, db } from "../config/firebase";
import type { ManagedUserDoc } from "../services/userManagement";
import { AuthContext, type AuthClaims } from "./auth-context";

const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.id);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ManagedUserDoc | null>(null);
  const [claims, setClaims] = useState<AuthClaims>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) {
        setProfile(null);
        setClaims({});
        setLoading(false);
        return;
      }
      try {
        const tokenResult = await next.getIdTokenResult(true);
        setClaims({
          role: typeof tokenResult.claims.role === "string" ? tokenResult.claims.role : undefined,
          roleId:
            typeof tokenResult.claims.roleId === "string"
              ? tokenResult.claims.roleId
              : undefined,
          admin: tokenResult.claims.admin === true,
        });

        const snap = await getDoc(doc(db, "users", next.uid));
        if (snap.exists()) {
          setProfile({ id: snap.id, ...(snap.data() as Omit<ManagedUserDoc, "id">) });
        } else {
          const roleFromJwt =
            typeof tokenResult.claims.role === "string" ? tokenResult.claims.role : "admin";
          const isAdminClaim = tokenResult.claims.admin === true || roleFromJwt === "admin";
          setProfile({
            id: next.uid,
            name: next.displayName || "Admin",
            username: (next.email ?? "admin").split("@")[0],
            phone: "",
            email: next.email ?? "",
            roleId:
              typeof tokenResult.claims.roleId === "string" ? tokenResult.claims.roleId : "admin",
            roleName: roleFromJwt,
            permissions: isAdminClaim ? ALL_PERMISSIONS : [],
            status: "active",
            lastActive: "Just now",
          });
        }
      } catch {
        setProfile(null);
        setClaims({});
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await cred.user.getIdToken(true);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false) => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken(forceRefresh);
  }, []);

  const role = claims.role || profile?.roleName || null;

  const isAdmin =
    claims.admin === true ||
    role === "admin" ||
    profile?.roleId === "admin" ||
    profile?.roleName?.toLowerCase() === "admin";

  const permissions = useMemo(() => {
    if (isAdmin) return ALL_PERMISSIONS;
    return (profile?.permissions ?? []) as PermissionId[];
  }, [isAdmin, profile?.permissions]);

  const hasPermission = useCallback(
    (permission: string) => {
      if (isAdmin) return true;
      return permissions.includes(permission as PermissionId);
    },
    [isAdmin, permissions],
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
      loading,
      login,
      logout,
      getIdToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
