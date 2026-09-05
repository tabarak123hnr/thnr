import {
  BedDouble,
  Bell,
  BookOpen,
  CalendarClock,
  ClipboardList,
  ContactRound,
  FileBarChart,
  Landmark,
  LayoutDashboard,
  LogOut,
  QrCode,
  Receipt,
  SlidersHorizontal,
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

const NAVY = "#050B18";
const GOLD = "#C5A059";
const GOLD_SOFT = "rgba(197, 160, 89, 0.18)";
const MUTED = "#8E949E";
const LINE = "rgba(197, 160, 89, 0.22)";

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
  FileBarChart,
  UserCog,
  SlidersHorizontal,
};

function GoldRule({ withCrest = false }: { withCrest?: boolean }) {
  if (!withCrest) {
    return (
      <div className="relative mx-5 flex items-center justify-center py-1">
        <div className="h-px w-full" style={{ background: LINE }} />
        <span
          className="absolute h-1.5 w-1.5 rotate-45"
          style={{ background: GOLD }}
        />
      </div>
    );
  }

  return (
    <div className="relative mx-5 flex items-center justify-center py-4">
      <div className="h-px w-full" style={{ background: LINE }} />
      <div
        className="absolute flex flex-col items-center"
        style={{ background: NAVY, padding: "0 10px" }}
      >
        {/* Crown */}
        <svg
          width="22"
          height="10"
          viewBox="0 0 22 10"
          fill="none"
          aria-hidden
          className="-mb-0.5"
        >
          <path
            d="M1 9 L4 3.5 L7.5 7 L11 1.5 L14.5 7 L18 3.5 L21 9 Z"
            fill={GOLD}
          />
          <circle cx="4" cy="3.2" r="1.1" fill={GOLD} />
          <circle cx="11" cy="1.4" r="1.2" fill={GOLD} />
          <circle cx="18" cy="3.2" r="1.1" fill={GOLD} />
        </svg>
        <span
          className="font-serif text-[1.35rem] font-bold leading-none tracking-tight"
          style={{ color: GOLD }}
        >
          T
        </span>
      </div>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useApp();
  const { profile, user, logout, role, hasPermission } = useAuth();
  const { roomsBadge, housekeepingBadge, ordersBadge, notificationsBadge } =
    useOpsBadges();

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
    if (itemId === "notifications") return notificationsBadge;
    return fallback ?? null;
  }

  return (
    <aside
      className="relative flex h-full w-[min(100vw,280px)] flex-col overflow-hidden text-white"
      style={{
        background: `linear-gradient(180deg, #07101f 0%, ${NAVY} 55%, #03060f 100%)`,
      }}
    >
      {/* Soft bottom pattern */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 100%, rgba(197,160,89,0.55) 0%, transparent 55%), repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.04) 10px, rgba(255,255,255,0.04) 11px)",
        }}
        aria-hidden
      />

      {/* Logo — large & centered like the luxury mock */}
      <div className="relative z-10 px-3 pb-2 pt-5">
        <img
          src="/logo.jpg"
          alt={t.brand}
          className="mx-auto w-full max-w-[248px] object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.5)]"
        />
      </div>

      <div className="relative z-10">
        <GoldRule />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex-1 overflow-y-auto px-3 pb-4 pt-4">
        {visibleSections.map((section) => (
          <div key={section.id} className="mb-5">
            <p
              className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: GOLD }}
            >
              {t.sections[section.labelKey as keyof typeof t.sections]}
            </p>
            <ul>
              {section.items.map((item, index) => {
                const Icon = icons[item.icon] ?? LayoutDashboard;
                const label = t.nav[item.labelKey as keyof typeof t.nav];
                const badge = resolveBadge(item.id, item.badge);
                const isDangerBadge =
                  item.id === "notifications" || item.badgeTone === "danger";

                return (
                  <li key={item.id}>
                    {index > 0 ? (
                      <div
                        className="mx-3 h-px"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      />
                    ) : null}
                    <NavLink
                      to={item.path}
                      end={item.path === "/"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group mx-1 my-0.5 flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                          isActive
                            ? "text-white"
                            : "text-[#9AA0AA] hover:bg-white/[0.04] hover:text-white",
                        )
                      }
                      style={({ isActive }) =>
                        isActive
                          ? {
                              border: `1px solid ${GOLD}`,
                              background: GOLD_SOFT,
                              boxShadow: `inset 0 0 0 1px rgba(197,160,89,0.15)`,
                            }
                          : { border: "1px solid transparent" }
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className="h-[17px] w-[17px] shrink-0"
                            strokeWidth={isActive ? 2.15 : 1.75}
                            style={{ color: isActive ? "#FFFFFF" : MUTED }}
                          />
                          <span
                            className={cn(
                              "flex-1 truncate tracking-wide",
                              isActive && "font-semibold",
                            )}
                          >
                            {label}
                          </span>
                          {badge != null && badge !== "" ? (
                            isDangerBadge ? (
                              <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B33E3E] px-1.5 text-[10px] font-bold text-white">
                                {badge}
                              </span>
                            ) : (
                              <span
                                className="ms-auto rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
                                style={{
                                  color: GOLD,
                                  border: `1px solid ${GOLD}`,
                                  background: "rgba(197,160,89,0.08)",
                                }}
                              >
                                {badge}
                              </span>
                            )
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

      {/* Crest + user */}
      <div className="relative z-10 mt-auto pb-3">
        <GoldRule withCrest />
        <div className="mx-3 mt-4 flex items-center gap-3 rounded-xl px-2 py-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
            style={{
              background: GOLD_SOFT,
              color: GOLD,
              border: `1px solid ${LINE}`,
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="truncate text-[11px]" style={{ color: MUTED }}>
              {roleLabel}
            </p>
          </div>
          <button
            type="button"
            title={t.logout}
            className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-white/[0.06]"
            style={{ color: MUTED }}
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
