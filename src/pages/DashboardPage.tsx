import {
  ArrowUpRight,
  BedDouble,
  Eye,
  LogOut,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { EmptyState, PageHeader } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import {
  buildOpsNotifications,
  formatNotificationAge,
} from "../lib/buildNotifications";
import { todayIsoDate } from "../lib/dutyPerformance";
import { cn, formatAge, formatRs } from "../lib/utils";
import { subscribeBookingRequests } from "../services/bookingRequests";
import { subscribeCheckIns, type CheckInRecord } from "../services/checkIns";
import { subscribeDuties, type DutyAssignment, type DutyStatus } from "../services/duties";
import { subscribeHousekeepingTasks } from "../services/housekeeping";
import { subscribeOrders, type FoodOrder } from "../services/orders";
import { subscribeRooms, type HotelRoom } from "../services/rooms";
import type { BookingRequest } from "../types/bookingRequest";
import type { HousekeepingTask } from "../types/housekeeping";

function tsMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string" || typeof value === "number") {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return Number((value as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

function startOfDayMs(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isSameCalendarDay(isoOrMs: string | number, dayStart: number) {
  const t = typeof isoOrMs === "number" ? isoOrMs : new Date(isoOrMs).getTime();
  if (Number.isNaN(t) || !t) return false;
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === dayStart;
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastNDays(n: number, now = new Date()) {
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(d);
  }
  return days;
}

function formatShortWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

const dutyStatusTone: Record<DutyStatus, "gold" | "info" | "success" | "danger" | "muted"> = {
  scheduled: "gold",
  in_progress: "info",
  completed: "success",
  missed: "danger",
  cancelled: "muted",
};

const dutyStatusLabel: Record<DutyStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  missed: "Missed",
  cancelled: "Cancelled",
};

const dutyStatusOrder: Record<DutyStatus, number> = {
  in_progress: 0,
  scheduled: 1,
  missed: 2,
  completed: 3,
  cancelled: 4,
};

function MetricCard({
  label,
  value,
  icon,
  featured = false,
  hint,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  featured?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 sm:p-5",
        featured
          ? "bg-[var(--text)] text-[var(--bg)] shadow-[var(--shadow)]"
          : "surface",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-sm font-medium",
            featured ? "text-white/70 dark:text-black/60" : "text-muted",
          )}
        >
          {label}
        </p>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            featured
              ? "bg-white/15 text-white dark:bg-black/10 dark:text-black"
              : "bg-accent-soft text-[var(--accent)]",
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-1 text-xs",
            featured ? "text-white/55 dark:text-black/50" : "text-muted",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function OccupancyDonut({
  percent,
  occupied,
  total,
}: {
  percent: number;
  occupied: number;
  total: number;
}) {
  const size = 168;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(100, percent));
  const dash = (filled / 100) * circumference;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--text)"
          strokeWidth={strokeWidth}
          opacity={0.12}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-3xl font-extrabold tracking-tight tabular-nums">{percent}%</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Occupied
        </p>
        <p className="mt-1 text-xs text-muted">
          {occupied}/{total || 0}
        </p>
      </div>
    </div>
  );
}

function GroupedBarChart({
  points,
}: {
  points: { label: string; room: number; food: number }[];
}) {
  const max = Math.max(...points.flatMap((p) => [p.room, p.food]), 1);
  const tip = [...points].reverse().find((p) => p.room > 0 || p.food > 0) || points[points.length - 1];

  return (
    <div className="relative pt-8">
      {tip ? (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg bg-[var(--text)] px-2.5 py-1 text-[11px] font-bold text-[var(--bg)] shadow"
          style={{
            left: `${(points.indexOf(tip) / Math.max(points.length - 1, 1)) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          {formatRs(tip.room + tip.food)}
          <span className="absolute start-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[var(--text)]" />
        </div>
      ) : null}

      <div className="flex h-48 items-end gap-2 sm:gap-3">
        {points.map((p) => {
          const roomH = Math.max(p.room > 0 ? 8 : 0, Math.round((p.room / max) * 100));
          const foodH = Math.max(p.food > 0 ? 8 : 0, Math.round((p.food / max) * 100));
          return (
            <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <div
                  className="w-[42%] max-w-5 rounded-t-md bg-[var(--text)] transition-all"
                  style={{ height: `${roomH}%` }}
                  title={`Rooms ${formatRs(p.room)}`}
                />
                <div
                  className="w-[42%] max-w-5 rounded-t-md bg-[var(--accent)] transition-all"
                  style={{ height: `${foodH}%` }}
                  title={`Food ${formatRs(p.food)}`}
                />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {p.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--text)]" /> Rooms
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent)]" /> Food
        </span>
      </div>
    </div>
  );
}

function AreaSpark({
  seriesA,
  seriesB,
}: {
  seriesA: number[];
  seriesB: number[];
}) {
  const w = 320;
  const h = 120;
  const max = Math.max(...seriesA, ...seriesB, 1);
  const toPoints = (values: number[]) =>
    values
      .map((v, i) => {
        const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * w;
        const y = h - (v / max) * (h - 12) - 6;
        return `${x},${y}`;
      })
      .join(" ");

  const areaPath = (values: number[]) => {
    if (!values.length) return "";
    const line = values
      .map((v, i) => {
        const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * w;
        const y = h - (v / max) * (h - 12) - 6;
        return `${i === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
    return `${line} L ${w} ${h} L 0 ${h} Z`;
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
      <path d={areaPath(seriesA)} fill="color-mix(in oklab, var(--text) 18%, transparent)" />
      <path d={areaPath(seriesB)} fill="color-mix(in oklab, var(--accent) 28%, transparent)" />
      <polyline
        points={toPoints(seriesA)}
        fill="none"
        stroke="var(--text)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={toPoints(seriesB)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MonthCalendar({
  arrivalDays,
  departureDays,
}: {
  arrivalDays: Set<number>;
  departureDays: Set<number>;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  return (
    <div className="min-w-[148px]">
      <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide">
        {now.toLocaleString(undefined, { month: "short", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted">
        {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day == null) return <span key={`e-${idx}`} />;
          const isArrival = arrivalDays.has(day);
          const isDeparture = departureDays.has(day);
          const isToday = day === today;
          return (
            <span
              key={day}
              className={cn(
                "flex h-6 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums",
                isToday && "ring-1 ring-[var(--accent)]",
                isArrival && "bg-[var(--accent)] text-[var(--accent-text)]",
                !isArrival && isDeparture && "bg-[var(--text)] text-[var(--bg)]",
                !isArrival && !isDeparture && "text-muted",
              )}
            >
              {day}
            </span>
          );
        })}
      </div>
      <div className="mt-3 space-y-1 text-[10px] text-muted">
        <p className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[var(--accent)]" /> Arrivals
        </p>
        <p className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[var(--text)]" /> Departures
        </p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { t, language } = useApp();

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [duties, setDuties] = useState<DutyAssignment[]>([]);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const a = subscribeRooms(setRooms);
    const b = subscribeCheckIns(setCheckIns);
    const c = subscribeOrders(setOrders);
    const d = subscribeBookingRequests(setBookings);
    const e = subscribeHousekeepingTasks(setTasks);
    const f = subscribeDuties(setDuties);
    return () => {
      a();
      b();
      c();
      d();
      e();
      f();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const dayStart = startOfDayMs();
  const nowMs = tick;

  const inHouse = useMemo(
    () => checkIns.filter((c) => c.status === "checked_in"),
    [checkIns],
  );

  const kpis = useMemo(() => {
    const arriving = bookings.filter(
      (b) =>
        (b.status === "pending" ||
          b.status === "confirmed" ||
          b.status === "reserved") &&
        isSameCalendarDay(b.checkInAt, dayStart),
    ).length;

    const departingToday = inHouse.filter((c) =>
      isSameCalendarDay(c.checkOutAt, dayStart),
    );
    const departingOverdue = inHouse.filter((c) => {
      const due = new Date(c.checkOutAt).getTime();
      return !Number.isNaN(due) && due <= nowMs;
    }).length;

    const occupied = rooms.filter(
      (r) => r.status === "occupied" || Boolean(r.guest),
    ).length;
    const totalRooms = rooms.length;

    return {
      arriving,
      departing: departingToday.length,
      departingOverdue,
      occupied,
      totalRooms,
    };
  }, [bookings, inHouse, rooms, dayStart, nowMs]);

  const liveOrders = useMemo(() => {
    void tick;
    return orders
      .filter((o) => o.status === "pending")
      .sort((a, b) => tsMs(a.createdAt) - tsMs(b.createdAt))
      .slice(0, 5)
      .map((o) => {
        const placed = tsMs(o.createdAt) || nowMs;
        const ageMinutes = Math.max(0, Math.floor((nowMs - placed) / 60000));
        return { ...o, ageMinutes };
      });
  }, [orders, tick, nowMs]);

  const attentionItems = useMemo(() => {
    void tick;
    const dirty = rooms
      .filter((r) => r.cleaningStatus === "dirty")
      .map((r) => ({
        id: `dirty-${r.id}`,
        title: `Dirty room · ${r.number}`,
        detail: r.guest?.name
          ? `Still dirty · guest ${r.guest.name}`
          : "Needs housekeeping after checkout",
        href: "/housekeeping",
        age: formatNotificationAge(tsMs(r.updatedAt) || nowMs, nowMs),
        tone: "danger" as const,
      }));

    const alerts = buildOpsNotifications({
      checkIns,
      orders,
      tasks,
      bookings,
      rooms,
      rs: t.common.rs,
    })
      .filter((n) => n.severity === "critical" || n.severity === "warning")
      .filter((n) => n.category !== "rooms" || !n.id.startsWith("room-dirty-"))
      .slice(0, 8)
      .map((n) => ({
        id: n.id,
        title: n.title,
        detail: n.body,
        href: n.href,
        age: formatNotificationAge(n.atMs, nowMs),
        tone: (n.severity === "critical" ? "danger" : "warning") as
          | "danger"
          | "warning",
      }));

    const seen = new Set<string>();
    const merged = [...dirty, ...alerts].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return merged.slice(0, 4);
  }, [rooms, checkIns, orders, tasks, bookings, tick, nowMs, t.common.rs]);

  const arrivalsToday = useMemo(() => {
    return bookings
      .filter(
        (b) =>
          (b.status === "pending" ||
            b.status === "confirmed" ||
            b.status === "reserved") &&
          isSameCalendarDay(b.checkInAt, dayStart),
      )
      .sort(
        (a, b) =>
          new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime(),
      );
  }, [bookings, dayStart]);

  const revenue = useMemo(() => {
    const ordersToday = orders.filter((o) =>
      isSameCalendarDay(tsMs(o.createdAt), dayStart),
    );
    const foodTotal = ordersToday.reduce((s, o) => s + (o.amount || 0), 0);

    const checkedOutToday = checkIns.filter(
      (c) =>
        c.status === "checked_out" &&
        isSameCalendarDay(tsMs(c.checkedOutAt) || c.checkOutAt, dayStart),
    );
    const roomTotal = checkedOutToday.reduce(
      (s, c) => s + Math.max(0, Number(c.roomCharges) || 0),
      0,
    );

    return {
      rooms: roomTotal,
      restaurant: foodTotal,
      total: roomTotal + foodTotal,
      checkOutCount: checkedOutToday.length,
      orderCount: ordersToday.length,
    };
  }, [orders, checkIns, dayStart]);

  const weekSeries = useMemo(() => {
    const days = lastNDays(7);
    return days.map((d) => {
      const start = startOfDayMs(d);
      const label = d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
      const room = checkIns
        .filter(
          (c) =>
            c.status === "checked_out" &&
            isSameCalendarDay(tsMs(c.checkedOutAt) || c.checkOutAt, start),
        )
        .reduce((s, c) => s + Math.max(0, Number(c.roomCharges) || 0), 0);
      const food = orders
        .filter((o) => isSameCalendarDay(tsMs(o.createdAt), start))
        .reduce((s, o) => s + Math.max(0, o.amount || 0), 0);
      const checkouts = checkIns.filter(
        (c) =>
          c.status === "checked_out" &&
          isSameCalendarDay(tsMs(c.checkedOutAt) || c.checkOutAt, start),
      ).length;
      const orderCount = orders.filter((o) =>
        isSameCalendarDay(tsMs(o.createdAt), start),
      ).length;
      return { label, room, food, checkouts, orderCount, iso: toIsoDate(d) };
    });
  }, [checkIns, orders]);

  const calendarMarks = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const arrivalDays = new Set<number>();
    const departureDays = new Set<number>();

    for (const b of bookings) {
      if (
        b.status !== "pending" &&
        b.status !== "confirmed" &&
        b.status !== "reserved"
      ) {
        continue;
      }
      const d = new Date(b.checkInAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        arrivalDays.add(d.getDate());
      }
    }
    for (const c of checkIns) {
      if (c.status !== "checked_in") continue;
      const d = new Date(c.checkOutAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        departureDays.add(d.getDate());
      }
    }
    return { arrivalDays, departureDays };
  }, [bookings, checkIns]);

  const todaysDuties = useMemo(() => {
    const today = todayIsoDate();
    return duties
      .filter((d) => d.date === today && d.status !== "cancelled")
      .sort((a, b) => {
        const byStatus = dutyStatusOrder[a.status] - dutyStatusOrder[b.status];
        if (byStatus !== 0) return byStatus;
        const byName = (a.assigneeName || "zzz").localeCompare(b.assigneeName || "zzz");
        if (byName !== 0) return byName;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 6);
  }, [duties, tick]);

  const occPct =
    kpis.totalRooms > 0
      ? Math.round((kpis.occupied / kpis.totalRooms) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        title={t.today}
        subtitle={t.todaySub}
        actions={
          <>
            <Link to="/check-in" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">{t.newCheckIn}</Button>
            </Link>
            <Link to="/counter" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto">
                {t.newOrder}
              </Button>
            </Link>
            <a
              href="https://hoteleye.punjab.gov.pk/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="secondary" className="w-full sm:w-auto">
                <Eye className="h-4 w-4" />
                Hotel Eye
              </Button>
            </a>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          featured
          label={t.revenueToday}
          value={formatRs(revenue.total, t.common.rs)}
          hint={`${revenue.checkOutCount} checkout · ${revenue.orderCount} orders`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <MetricCard
          label={t.arriving}
          value={String(kpis.arriving)}
          hint={t.expectedToday}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label={t.occupied}
          value={
            kpis.totalRooms
              ? `${kpis.occupied}/${kpis.totalRooms}`
              : String(kpis.occupied)
          }
          hint={`${occPct}% ${t.live}`}
          icon={<BedDouble className="h-4 w-4" />}
        />
        <MetricCard
          label={t.departing}
          value={String(kpis.departing)}
          hint={
            kpis.departingOverdue
              ? `${kpis.departingOverdue} ${t.overdue}`
              : t.expectedToday
          }
          icon={<LogOut className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title="Results"
            action={
              <Link to="/accounts">
                <Button size="sm" variant="gold">
                  Check now
                </Button>
              </Link>
            }
          />
          <p className="mb-2 text-sm text-muted">
            Room vs food revenue for the last 7 days.
          </p>
          <GroupedBarChart points={weekSeries} />
        </Card>

        <Card className="flex flex-col">
          <CardHeader title={t.occupied} badge={<Badge tone="info">{t.live}</Badge>} />
          <OccupancyDonut
            percent={occPct}
            occupied={kpis.occupied}
            total={kpis.totalRooms}
          />
          <ul className="mt-5 divide-y divide-[color-mix(in_oklab,var(--border)_85%,transparent)]">
            {attentionItems.length === 0 ? (
              <li className="py-3 text-sm text-muted">
                Nothing urgent — dirty rooms and overdue items show here.
              </li>
            ) : (
              attentionItems.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className="flex items-start justify-between gap-3 py-3 hover:opacity-90"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">{item.detail}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted">{item.age}</span>
                  </Link>
                </li>
              ))
            )}
          </ul>
          <Link to="/notifications" className="mt-auto pt-4">
            <Button variant="gold" className="w-full">
              Check now
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title="Activity"
            action={
              <div className="flex flex-wrap gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--text)]" /> Checkouts
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> Orders
                </span>
              </div>
            }
          />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <AreaSpark
                seriesA={weekSeries.map((d) => d.checkouts)}
                seriesB={weekSeries.map((d) => d.orderCount)}
              />
              <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-muted">
                {weekSeries.map((d) => (
                  <span key={d.iso}>{d.label}</span>
                ))}
              </div>
            </div>
            <MonthCalendar
              arrivalDays={calendarMarks.arrivalDays}
              departureDays={calendarMarks.departureDays}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t.liveOrders}
            action={
              <Link
                to="/orders"
                className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-app"
              >
                {t.viewAll}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {liveOrders.length === 0 ? (
            <EmptyState message="No active kitchen orders right now." />
          ) : (
            <ul className="space-y-3">
              {liveOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-app bg-app px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-bold">
                      {order.token}{" "}
                      <span className="font-medium text-muted">
                        · Room {order.roomNumber}
                      </span>
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {order.items
                        .map(
                          (i) =>
                            `${i.qty}× ${
                              language === "ur" && i.nameUr ? i.nameUr : i.name
                            }`,
                        )
                        .join(", ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <Badge
                      tone={
                        order.ageMinutes >= 12
                          ? "danger"
                          : order.paymentStatus === "due"
                            ? "warning"
                            : "info"
                      }
                    >
                      {order.ageMinutes >= 12 ? "Late" : "Pending"}
                    </Badge>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatAge(order.ageMinutes)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t.arrivingToday}
            action={
              <Link
                to="/booking-requests"
                className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-app"
              >
                {t.viewAll}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {arrivalsToday.length === 0 ? (
            <EmptyState message={t.noArrivals} />
          ) : (
            <ul className="space-y-3">
              {arrivalsToday.map((b) => (
                <li
                  key={b.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-app bg-app px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-bold">{b.guestName}</p>
                    <p className="text-xs text-muted">
                      Room {b.roomNumber} · {formatShortWhen(b.checkInAt)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      b.status === "pending"
                        ? "warning"
                        : b.status === "reserved" || b.status === "confirmed"
                          ? "info"
                          : "muted"
                    }
                  >
                    {b.status === "pending"
                      ? "Pending"
                      : b.status === "reserved" || b.status === "confirmed"
                        ? "Reserved"
                        : b.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title={t.liveDutyRoster}
            badge={
              todaysDuties.length ? (
                <Badge tone="gold">{todaysDuties.length}</Badge>
              ) : undefined
            }
            action={
              <Link
                to="/duties-roster"
                className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-app"
              >
                {t.viewAll}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {todaysDuties.length === 0 ? (
            <EmptyState message={t.noDutiesToday} />
          ) : (
            <ul className="space-y-3">
              {todaysDuties.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-app bg-app px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{row.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {row.assigneeName || t.unassigned} · {row.shift}
                    </p>
                  </div>
                  <Badge tone={dutyStatusTone[row.status]}>
                    {dutyStatusLabel[row.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
