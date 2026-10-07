import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isRestaurantEmail } from "../../config/restaurantAuth";
import { useAuth } from "../../context/auth-context";
import { Button } from "../ui/Button";

/** Only the dedicated restaurant login may enter /restaurant/* */
export function RestaurantProtectedRoute() {
  const { user, loading, logout, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          <p className="text-sm text-muted">Loading restaurant…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isRestaurantEmail(user.email) && !isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app px-6 text-center">
        <h1 className="text-xl font-extrabold">Restaurant access only</h1>
        <p className="max-w-sm text-sm text-muted">
          Sign in with the restaurant account to open parcel and delivery.
        </p>
        <Button type="button" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
    );
  }

  return <Outlet />;
}
