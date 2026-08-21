import { createContext, useContext } from "react";
import type { User } from "firebase/auth";
import type { PermissionId } from "../config/permissions";
import type { ManagedUserDoc } from "../services/userManagement";

export interface AuthClaims {
  role?: string;
  roleId?: string;
  admin?: boolean;
}

export interface AuthContextValue {
  user: User | null;
  profile: ManagedUserDoc | null;
  claims: AuthClaims;
  role: string | null;
  permissions: PermissionId[];
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
