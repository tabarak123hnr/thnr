import { Navigate, Outlet, useLocation } from "react-router-dom";
import { navigation, pathPermission } from "../../config/navigation";
import { useAuth } from "../../context/auth-context";

function firstAllowedPath(hasPermission: (p: string) => boolean) {
  for (const section of navigation) {
    for (const item of section.items) {
      if (hasPermission(item.permission)) return item.path;
    }
  }
  return "/login";
}

export function ProtectedRoute() {
  const { user, loading, hasPermission, isAdmin } = useAuth();
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

  const required = pathPermission[location.pathname];
  if (required && !isAdmin && !hasPermission(required)) {
    return <Navigate to={firstAllowedPath(hasPermission)} replace />;
  }

  return <Outlet />;
}
