import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { EmptyState, PageHeader, StatCard } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { attentionItems, kpis, liveOrders, revenueBreakdown } from "../data/mock";
import { formatAge, formatRs } from "../lib/utils";

const statusTone = {
  preparing: "warning",
  on_the_way: "purple",
  received: "info",
  served: "success",
  cancelled: "danger",
} as const;

const sourceTone = {
  table: "muted",
  room: "warning",
  takeaway: "info",
  counter: "gold",
} as const;

export function DashboardPage() {
  const { t, language } = useApp();
  const occPct = Math.round((kpis.occupied / kpis.totalRooms) * 100);

  return (
    <div>
      <PageHeader
        title={t.today}
        subtitle={t.todaySub}
        actions={
          <>
            <Button className="md:hidden">{t.newCheckIn}</Button>
            <Button variant="secondary" className="md:hidden">
              {t.newOrder}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t.arriving} value={String(kpis.arriving)} hint={t.expectedToday} />
        <StatCard
          label={t.departing}
          value={String(kpis.departing)}
          hint={`${kpis.departingOverdue} ${t.overdue}`}
          alert={kpis.departingOverdue}
        />
        <StatCard
          label={t.occupied}
          value={`${kpis.occupied}/${kpis.totalRooms}`}
          hint={`${occPct}%`}
          badge={<Badge tone="info">{t.live}</Badge>}
        />
        <StatCard
          label={t.revenueToday}
          value={String(kpis.revenueToday)}
          hint={t.roomsPlusRestaurant}
          badge={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-app bg-app px-2 py-0.5 text-[11px] font-semibold text-muted">
              {t.common.rs}
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
            </span>
          }
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title={t.liveOrders}
            action={
              <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-app">
                {t.viewAll}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <Table headers={[t.token, t.from, t.items, t.status, t.age]}>
            {liveOrders.slice(0, 4).map((order) => (
              <Tr key={order.id}>
                <Td>
                  <span className="font-bold">{order.token}</span>
                </Td>
                <Td>
                  <Badge tone={sourceTone[order.source]}>{order.sourceLabel}</Badge>
                </Td>
                <Td className="max-w-[240px]">
                  <span className="line-clamp-2 text-[var(--text-muted)]">
                    {order.items
                      .map((i) => `${i.qty}x ${language === "ur" ? i.nameUr : i.name}`)
                      .join(", ")}
                  </span>
                </Td>
                <Td>
                  <Badge tone={statusTone[order.status]}>
                    {order.status === "preparing"
                      ? t.preparing
                      : order.status === "on_the_way"
                        ? t.onTheWay
                        : order.status === "received"
                          ? t.received
                          : order.status === "served"
                            ? t.served
                            : t.cancelled}
                  </Badge>
                </Td>
                <Td className="text-muted">{formatAge(order.ageMinutes)}</Td>
              </Tr>
            ))}
          </Table>
        </Card>

        <Card>
          <CardHeader
            title={t.needsAttention}
            badge={
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[11px] font-bold text-white">
                {attentionItems.length}
              </span>
            }
          />
          <ul className="space-y-4">
            {attentionItems.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold leading-snug">
                      {language === "ur" ? item.titleUr : item.title}
                    </p>
                    <span className="shrink-0 text-xs text-muted">{item.age}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {language === "ur" ? item.detailUr : item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-app">
            {t.seeHistory}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.arrivingToday} />
          <EmptyState message={t.noArrivals} />
        </Card>

        <Card>
          <CardHeader
            title={t.revenueToday}
            action={
              <Link to="/accounts" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-app">
                {t.viewAll}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <p className="text-3xl font-extrabold">{formatRs(revenueBreakdown.total, t.common.rs)}</p>
          <div className="mt-5 space-y-4">
            {[
              { label: t.rooms, value: revenueBreakdown.rooms },
              { label: t.restaurant, value: revenueBreakdown.restaurant },
              { label: t.roomService, value: revenueBreakdown.roomService },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="font-semibold">{formatRs(row.value, t.common.rs)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-app">
                  <div className="h-full w-0 rounded-full bg-accent" />
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
