import { Navigate, Outlet, useLocation } from "react-router-dom";
import { pathPermission } from "../../config/navigation";
import { useAuth } from "../../context/auth-context";
import { Button } from "../ui/Button";

export function ProtectedRoute() {
  const { user, loading, hasPermission, isAdmin, defaultPath, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          <p className="text-sm text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!defaultPath) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app px-6 text-center">
        <h1 className="text-xl font-extrabold">No modules assigned</h1>
        <p className="max-w-sm text-sm text-muted">
          Your account has no page access yet. Ask an admin to grant permissions, then sign in again.
        </p>
        <Button type="button" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
    );
  }

  const required = pathPermission[location.pathname];
  if (required && !isAdmin && !hasPermission(required)) {
    return <Navigate to={defaultPath} replace />;
  }

  // Logged in but landed on "/" without dashboard access
  if (location.pathname === "/" && !isAdmin && !hasPermission("dashboard")) {
    return <Navigate to={defaultPath} replace />;
  }

  return <Outlet />;
}
