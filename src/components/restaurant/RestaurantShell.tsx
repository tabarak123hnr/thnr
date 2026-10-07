import { LogOut, Package, Truck } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Button } from "../ui/Button";
import { useAuth } from "../../context/auth-context";
import { cn } from "../../lib/utils";

const links = [
  { to: "/restaurant/parcel", label: "Parcel", icon: Package, ready: true },
  { to: "/restaurant/delivery", label: "Delivery", icon: Truck, ready: false },
];

export function RestaurantShell() {
  const { profile, user, logout } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-app text-app">
      <header className="sticky top-0 z-30 border-b border-app bg-elevated/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/logo.jpg"
              alt="Tabarak"
              className="h-10 w-auto rounded-lg object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-tight">
                Restaurant system
              </p>
              <p className="truncate text-xs text-muted">
                {profile?.name || user?.email || "Staff"} · Parcel & delivery
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1.5">
            {links.map((link) => {
              const Icon = link.icon;
              if (!link.ready) {
                return (
                  <span
                    key={link.to}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-app px-3 py-2 text-xs font-semibold text-muted"
                    title="Coming next"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {link.label}
                    <span className="rounded bg-app px-1.5 py-0.5 text-[10px]">Soon</span>
                  </span>
                );
              }
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition",
                      isActive
                        ? "bg-[var(--accent)] text-[var(--accent-text)]"
                        : "border border-app bg-app text-muted hover:text-app",
                    )
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {link.label}
                </NavLink>
              );
            })}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void logout()}
              className="ms-1"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
        <div className="mx-auto w-full max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
