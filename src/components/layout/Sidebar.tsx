import {
  BedDouble,
  Bell,
  BookOpen,
  CalendarClock,
  ClipboardList,
  ContactRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  QrCode,
  Receipt,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { navigation } from "../../config/navigation";
import { useApp } from "../../context/app-context";
import { useAuth } from "../../context/auth-context";
import { useOpsBadges } from "../../hooks/useOpsBadges";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/Badge";

const icons: Record<string, LucideIcon> = {
  LayoutDashboard,
  Bell,
  BedDouble,
  UserPlus,
  ContactRound,
  CalendarClock,
  Sparkles,
  QrCode,
  UtensilsCrossed,
  ClipboardList,
  BookOpen,
  Landmark,
  Receipt,
  Users,
  Smartphone,
  UserCog,
  SlidersHorizontal,
};

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useApp();
  const { profile, user, logout, role, hasPermission } = useAuth();
  const { roomsBadge, housekeepingBadge, ordersBadge } = useOpsBadges();

  const displayName = profile?.name || user?.displayName || "Staff";
  const roleLabel = role || profile?.roleName || t.roles.admin;
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "TA";

  const visibleSections = useMemo(
    () =>
      navigation
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => hasPermission(item.permission)),
        }))
        .filter((section) => section.items.length > 0),
    [hasPermission],
  );

  function resolveBadge(itemId: string, fallback?: number | string) {
    if (itemId === "rooms") return roomsBadge;
    if (itemId === "housekeeping") return housekeepingBadge;
    if (itemId === "orders") return ordersBadge;
    return fallback ?? null;
  }

  return (
    <aside className="flex h-full w-[260px] flex-col border-e border-app bg-sidebar">
      <div className="border-b border-app px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-[var(--accent-text)] shadow-sm">
            <BedDouble className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-tight">{t.brand}</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t.brandSub}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleSections.map((section) => (
          <div key={section.id} className="mb-5">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              {t.sections[section.labelKey as keyof typeof t.sections]}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = icons[item.icon] ?? LayoutDashboard;
                const label = t.nav[item.labelKey as keyof typeof t.nav];
                const badge = resolveBadge(item.id, item.badge);
                return (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-accent-soft text-[var(--text)] ring-1 ring-[color-mix(in_oklab,var(--accent)_45%,transparent)]"
                            : "text-[var(--text-muted)] hover:bg-app hover:text-[var(--text)]",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-[var(--accent)]" : "opacity-80",
                            )}
                            strokeWidth={isActive ? 2.4 : 2}
                          />
                          <span className="flex-1 truncate">{label}</span>
                          {badge != null && badge !== "" ? (
                            <Badge
                              tone={
                                item.badgeTone === "danger"
                                  ? "danger"
                                  : item.badgeTone === "info"
                                    ? "info"
                                    : "gold"
                              }
                              className="ms-auto"
                            >
                              {badge}
                            </Badge>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-app p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--text)] text-xs font-bold text-[var(--bg-elevated)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{displayName}</p>
            <p className="truncate text-xs text-muted">{roleLabel}</p>
          </div>
          <button
            type="button"
            title={t.logout}
            className="cursor-pointer rounded-lg p-2 text-muted hover:bg-app hover:text-app"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
