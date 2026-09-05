import { ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { EmptyState, PageHeader, StatCard } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import {
  buildOpsNotifications,
  formatNotificationAge,
} from "../lib/buildNotifications";
import { cn, formatAge, formatRs } from "../lib/utils";
import { subscribeBookingRequests } from "../services/bookingRequests";
import { subscribeCheckIns, type CheckInRecord } from "../services/checkIns";
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

export function DashboardPage() {
  const { t, language } = useApp();

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const a = subscribeRooms(setRooms);
    const b = subscribeCheckIns(setCheckIns);
    const c = subscribeOrders(setOrders);
    const d = subscribeBookingRequests(setBookings);
    const e = subscribeHousekeepingTasks(setTasks);
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
      .slice(0, 6)
      .map((o) => {
        const placed = tsMs(o.createdAt) || nowMs;
        const ageMinutes = Math.max(0, Math.floor((nowMs - placed) / 60000));
        return { ...o, ageMinutes };
      });
  }, [orders, tick, nowMs]);

  const attentionItems = useMemo(() => {
    void tick;
    // Prefer dirty rooms + top actionable ops alerts
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

    // Dirty rooms first, then other alerts (dedupe by id)
    const seen = new Set<string>();
    const merged = [...dirty, ...alerts].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return merged.slice(0, 8);
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
    const foodPaid = ordersToday
      .filter((o) => o.paymentStatus === "paid")
      .reduce((s, o) => s + (o.amount || 0), 0);

    const checkedOutToday = checkIns.filter(
      (c) =>
        c.status === "checked_out" &&
        isSameCalendarDay(tsMs(c.checkedOutAt) || c.checkOutAt, dayStart),
    );
    const roomTotal = checkedOutToday.reduce(
      (s, c) => s + Math.max(0, Number(c.roomCharges) || 0),
      0,
    );

    const total = roomTotal + foodTotal;
    return {
      rooms: roomTotal,
      restaurant: foodTotal,
      roomService: foodPaid,
      total,
      checkOutCount: checkedOutToday.length,
      orderCount: ordersToday.length,
    };
  }, [orders, checkIns, dayStart]);

  const occPct =
    kpis.totalRooms > 0
      ? Math.round((kpis.occupied / kpis.totalRooms) * 100)
      : 0;

  function barWidth(value: number) {
    if (!revenue.total) return 0;
    return Math.max(4, Math.round((value / revenue.total) * 100));
  }

  return (
    <div>
      <PageHeader
        title={t.today}
        subtitle={t.todaySub}
        actions={
          <>
            <Link to="/check-in" className="w-full md:hidden sm:w-auto">
              <Button className="w-full sm:w-auto">{t.newCheckIn}</Button>
            </Link>
            <Link to="/counter" className="w-full md:hidden sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto">
                {t.newOrder}
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.arriving}
          value={String(kpis.arriving)}
          hint={t.expectedToday}
        />
        <StatCard
          label={t.departing}
          value={String(kpis.departing)}
          hint={`${kpis.departingOverdue} ${t.overdue}`}
          alert={kpis.departingOverdue || undefined}
        />
        <StatCard
          label={t.occupied}
          value={
            kpis.totalRooms
              ? `${kpis.occupied}/${kpis.totalRooms}`
              : String(kpis.occupied)
          }
          hint={`${occPct}%`}
          badge={<Badge tone="info">{t.live}</Badge>}
        />
        <StatCard
          label={t.revenueToday}
          value={formatRs(revenue.total, t.common.rs)}
          hint={t.roomsPlusRestaurant}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
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
            <Table headers={[t.token, t.from, t.items, t.status, t.age]}>
              {liveOrders.map((order) => (
                <Tr key={order.id}>
                  <Td>
                    <span className="font-bold">{order.token}</span>
                  </Td>
                  <Td>
                    <Badge tone="warning">Room {order.roomNumber}</Badge>
                  </Td>
                  <Td className="max-w-[240px]">
                    <span className="line-clamp-2 text-[var(--text-muted)]">
                      {order.items
                        .map(
                          (i) =>
                            `${i.qty}× ${
                              language === "ur" && i.nameUr ? i.nameUr : i.name
                            }`,
                        )
                        .join(", ")}
                    </span>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        order.ageMinutes >= 12
                          ? "danger"
                          : order.paymentStatus === "due"
                            ? "warning"
                            : "info"
                      }
                    >
                      {order.ageMinutes >= 12
                        ? "Late"
                        : order.paymentStatus === "due"
                          ? "Pending · Due"
                          : "Pending · Paid"}
                    </Badge>
                  </Td>
                  <Td className="text-muted">{formatAge(order.ageMinutes)}</Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title={t.needsAttention}
            badge={
              attentionItems.length ? (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[11px] font-bold text-white">
                  {attentionItems.length}
                </span>
              ) : undefined
            }
            action={
              <Link
                to="/notifications"
                className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-app"
              >
                {t.viewAll}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {attentionItems.length === 0 ? (
            <EmptyState message="Nothing urgent — dirty rooms and overdue items will show here." />
          ) : (
            <ul className="space-y-4">
              {attentionItems.map((item) => (
                <li key={item.id}>
                  <Link to={item.href} className="flex gap-3 hover:opacity-90">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        item.tone === "danger"
                          ? "bg-[var(--danger)]"
                          : "bg-[var(--warning)]",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold leading-snug">{item.title}</p>
                        <span className="shrink-0 text-xs text-muted">{item.age}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                    </div>
                  </Link>
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
            title={t.revenueToday}
            action={
              <Link
                to="/invoices"
                className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-app"
              >
                {t.viewAll}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <p className="text-3xl font-extrabold">
            {formatRs(revenue.total, t.common.rs)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {revenue.checkOutCount} checkout
            {revenue.checkOutCount === 1 ? "" : "s"} · {revenue.orderCount} food
            order{revenue.orderCount === 1 ? "" : "s"} today
          </p>
          <div className="mt-5 space-y-4">
            {[
              { label: t.rooms, value: revenue.rooms },
              { label: t.restaurant, value: revenue.restaurant },
              { label: "Food paid", value: revenue.roomService },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="font-semibold">
                    {formatRs(row.value, t.common.rs)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-app">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${barWidth(row.value)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-muted">{t.revenueNote}</p>
        </Card>
      </div>
    </div>
  );
}
