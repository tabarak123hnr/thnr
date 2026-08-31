import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  DoorOpen,
  Sparkles,
  BedDouble,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState, PageHeader, StatCard } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import {
  buildOpsNotifications,
  formatNotificationAge,
} from "../lib/buildNotifications";
import { cn } from "../lib/utils";
import { subscribeBookingRequests } from "../services/bookingRequests";
import { subscribeCheckIns } from "../services/checkIns";
import { subscribeHousekeepingTasks } from "../services/housekeeping";
import { subscribeOrders } from "../services/orders";
import { subscribeRooms } from "../services/rooms";
import type { BookingRequest } from "../types/bookingRequest";
import type { CheckInRecord } from "../types/checkIn";
import type { HousekeepingTask } from "../types/housekeeping";
import {
  NOTIFICATION_CATEGORIES,
  type OpsNotification,
  type OpsNotificationCategory,
  type OpsNotificationSeverity,
} from "../types/notification";
import type { FoodOrder } from "../types/order";
import type { HotelRoom } from "../types/room";

const severityTone: Record<
  OpsNotificationSeverity,
  "danger" | "warning" | "info" | "success"
> = {
  critical: "danger",
  warning: "warning",
  info: "info",
  success: "success",
};

const severityLabel: Record<OpsNotificationSeverity, string> = {
  critical: "Urgent",
  warning: "Action",
  info: "FYI",
  success: "Done",
};

const categoryIcon: Record<OpsNotificationCategory, typeof Bell> = {
  orders: ClipboardList,
  checkout: DoorOpen,
  arrivals: CalendarClock,
  housekeeping: Sparkles,
  bookings: CalendarClock,
  payments: CreditCard,
  rooms: BedDouble,
};

const categoryLabel: Record<OpsNotificationCategory, string> = {
  orders: "Orders",
  checkout: "Check-out",
  arrivals: "Arrivals",
  housekeeping: "Housekeeping",
  bookings: "Bookings",
  payments: "Payments",
  rooms: "Rooms",
};

export function NotificationsPage() {
  const { t } = useApp();

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [category, setCategory] = useState<OpsNotificationCategory | "all">("all");
  const [severity, setSeverity] = useState<"all" | OpsNotificationSeverity>("all");
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const a = subscribeCheckIns(setCheckIns);
    const b = subscribeOrders(setOrders);
    const c = subscribeHousekeepingTasks(setTasks);
    const d = subscribeBookingRequests(setBookings);
    const e = subscribeRooms(setRooms);
    return () => {
      a();
      b();
      c();
      d();
      e();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const notifications = useMemo(() => {
    void tick;
    return buildOpsNotifications({
      checkIns,
      orders,
      tasks,
      bookings,
      rooms,
      rs: t.common.rs,
    });
  }, [checkIns, orders, tasks, bookings, rooms, tick, t.common.rs]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (category !== "all" && n.category !== category) return false;
      if (severity !== "all" && n.severity !== severity) return false;
      return true;
    });
  }, [notifications, category, severity]);

  const stats = useMemo(() => {
    const urgent = notifications.filter((n) => n.severity === "critical").length;
    const action = notifications.filter((n) => n.severity === "warning").length;
    const byCat = NOTIFICATION_CATEGORIES.filter((c) => c.value !== "all").map(
      (c) => ({
        key: c.value as OpsNotificationCategory,
        count: notifications.filter((n) => n.category === c.value).length,
      }),
    );
    return { urgent, action, total: notifications.length, byCat };
  }, [notifications]);

  return (
    <div>
      <PageHeader
        title={t.pages.notificationsTitle}
        subtitle="Live alerts from orders, stays, housekeeping, bookings, payments, and rooms."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Open alerts"
          value={String(stats.total)}
          hint="Needs attention now"
          alert={stats.total || undefined}
        />
        <StatCard
          label="Urgent"
          value={String(stats.urgent)}
          hint="Overdue checkout / late kitchen"
          alert={stats.urgent || undefined}
        />
        <StatCard
          label="Action needed"
          value={String(stats.action)}
          hint="Assign, confirm, or collect"
        />
      </div>

      <Card className="mb-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
          By area
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {stats.byCat.map((c) => {
            const Icon = categoryIcon[c.key];
            const active = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(active ? "all" : c.key)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start transition",
                  active
                    ? "border-[var(--accent)] bg-accent-soft"
                    : "border-app bg-app hover:border-[color-mix(in_oklab,var(--accent)_40%,var(--border))]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {categoryLabel[c.key]}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    c.count
                      ? "bg-[var(--accent)] text-white"
                      : "bg-elevated text-muted",
                  )}
                >
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {NOTIFICATION_CATEGORIES.map((c) => (
          <Button
            key={c.value}
            size="sm"
            variant={category === c.value ? "gold" : "secondary"}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </Button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "All levels"],
            ["critical", "Urgent"],
            ["warning", "Action"],
            ["info", "FYI"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={severity === value ? "primary" : "secondary"}
            onClick={() => setSeverity(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState message="All clear — no alerts in this filter. New kitchen tickets, overdue checkouts, dirty rooms, and pending bookings will show up here." />
          <div className="flex justify-center gap-2 pb-6">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-muted">Operations look quiet right now.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((n) => (
            <NotificationCard key={n.id} n={n} nowMs={tick} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationCard({ n, nowMs }: { n: OpsNotification; nowMs: number }) {
  const Icon = categoryIcon[n.category];
  return (
    <Card
      className={cn(
        "!p-0 overflow-hidden",
        n.severity === "critical" &&
          "ring-1 ring-red-300/80 dark:ring-red-900",
        n.severity === "warning" &&
          "ring-1 ring-orange-300/70 dark:ring-orange-900",
      )}
    >
      <div className="flex gap-0">
        <div
          className={cn(
            "w-1.5 shrink-0",
            n.severity === "critical" && "bg-[var(--danger)]",
            n.severity === "warning" && "bg-[var(--warning)]",
            n.severity === "info" && "bg-sky-500",
            n.severity === "success" && "bg-emerald-500",
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app bg-app">
              <Icon className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">{n.title}</p>
                <Badge tone={severityTone[n.severity]}>
                  {severityLabel[n.severity]}
                </Badge>
                <Badge tone="muted">{categoryLabel[n.category]}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{n.body}</p>
              <p className="mt-2 text-[11px] font-semibold text-muted">
                {formatNotificationAge(n.atMs, nowMs)}
              </p>
            </div>
          </div>
          <Link to={n.href} className="shrink-0 self-start sm:self-center">
            <Button
              size="sm"
              variant="secondary"
              className="cursor-pointer"
              icon={<ArrowUpRight className="h-3.5 w-3.5" />}
            >
              Open
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
