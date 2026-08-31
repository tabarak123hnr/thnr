import { Check, Clock3, Eye, Trash2, UtensilsCrossed } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { EmptyState, PageHeader, StatCard } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { cn, formatRs } from "../lib/utils";
import {
  deleteFoodOrder,
  markOrderDelivered,
  markOrderPayment,
  subscribeOrders,
  type FoodOrder,
} from "../services/orders";

function createdAtMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") {
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

function waitMinutes(createdAt: unknown) {
  const ms = createdAtMs(createdAt);
  if (!ms) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / 60000));
}

function formatWaitLabel(mins: number) {
  if (mins < 1) return "Just in";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatWhen(value: unknown) {
  const ms = createdAtMs(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function waitTone(mins: number): "success" | "warning" | "danger" | "info" {
  if (mins >= 25) return "danger";
  if (mins >= 12) return "warning";
  return "info";
}

export function OrdersPage() {
  const { t, language } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();

  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [viewRow, setViewRow] = useState<FoodOrder | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<FoodOrder | null>(null);

  useEffect(() => {
    return subscribeOrders(setOrders);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const active = useMemo(() => {
    void nowTick;
    return orders
      .filter((o) => o.status === "pending")
      .sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));
  }, [orders, nowTick]);

  const pendingAmount = active.reduce((s, o) => s + o.amount, 0);
  const dueAmount = active
    .filter((o) => o.paymentStatus === "due")
    .reduce((s, o) => s + o.amount, 0);
  const urgentCount = active.filter((o) => waitMinutes(o.createdAt) >= 12).length;
  const roomsWaiting = new Set(active.map((o) => o.roomNumber)).size;

  async function onDeliver(row: FoodOrder) {
    setActingId(row.id);
    try {
      await markOrderDelivered(row.id);
      toastSuccess("Delivered", `${row.token} · Room ${row.roomNumber}`);
      if (viewRow?.id === row.id) setViewRow(null);
    } catch (err) {
      toastError(
        "Could not mark delivered",
        err instanceof Error ? err.message : "Try again.",
      );
    } finally {
      setActingId(null);
    }
  }

  async function onMarkPaid(row: FoodOrder) {
    if (row.paymentStatus === "paid") return;
    setActingId(row.id);
    try {
      await markOrderPayment(row.id, "paid");
      toastSuccess("Marked paid", `${row.token} · ${formatRs(row.amount, t.common.rs)}`);
    } catch (err) {
      toastError(
        "Could not update payment",
        err instanceof Error ? err.message : "Try again.",
      );
    } finally {
      setActingId(null);
    }
  }

  async function onDeleteConfirm() {
    if (!deleteRow) return;
    setActingId(deleteRow.id);
    try {
      await deleteFoodOrder(deleteRow.id);
      toastSuccess("Order removed", "Amount removed from guest bill extras.");
      if (viewRow?.id === deleteRow.id) setViewRow(null);
      setDeleteRow(null);
    } catch (err) {
      toastError(
        "Delete failed",
        err instanceof Error ? err.message : "Try again.",
      );
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.ordersTitle}
        subtitle={t.pages.ordersSub}
        actions={
          <Link to="/counter">
            <Button icon={<UtensilsCrossed className="h-4 w-4" />}>Open counter</Button>
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Active tickets"
          value={String(active.length)}
          hint="Waiting to be delivered"
          alert={active.length || undefined}
        />
        <StatCard
          label="Kitchen value"
          value={formatRs(pendingAmount, t.common.rs)}
          hint={`${roomsWaiting} room${roomsWaiting === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Payment still due"
          value={formatRs(dueAmount, t.common.rs)}
          hint={urgentCount ? `${urgentCount} running late` : "Unpaid food tickets"}
          alert={dueAmount > 0 ? 1 : undefined}
        />
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState message="No active orders. Place room service from the Counter — delivered tickets leave this queue." />
          <div className="flex justify-center pb-6">
            <Link to="/counter">
              <Button icon={<UtensilsCrossed className="h-4 w-4" />}>Go to counter</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((row) => {
            const mins = waitMinutes(row.createdAt);
            const tone = waitTone(mins);
            return (
              <article
                key={row.id}
                className={cn(
                  "flex flex-col rounded-2xl border bg-[var(--surface)] p-4 shadow-sm transition",
                  tone === "danger"
                    ? "border-red-300/80 ring-1 ring-red-200/60 dark:border-red-900"
                    : tone === "warning"
                      ? "border-orange-300/80 ring-1 ring-orange-200/50 dark:border-orange-900"
                      : "border-app",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-3xl font-extrabold tracking-tight">
                      {row.roomNumber}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-muted">{row.guestName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge tone="gold">{row.token}</Badge>
                    <Badge tone={tone}>
                      <Clock3 className="me-1 h-3 w-3" />
                      {formatWaitLabel(mins)}
                    </Badge>
                    <Badge tone={row.paymentStatus === "paid" ? "success" : "warning"}>
                      {row.paymentStatus === "paid" ? "Paid" : "Due"}
                    </Badge>
                  </div>
                </div>

                <ul className="mt-4 flex-1 space-y-1.5 border-y border-app py-3">
                  {row.items.map((item, idx) => (
                    <li
                      key={`${item.menuItemId}-${idx}`}
                      className="flex items-baseline justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="font-extrabold text-[var(--accent)]">{item.qty}×</span>{" "}
                        <span className="font-medium">
                          {language === "ur" && item.nameUr ? item.nameUr : item.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {formatRs(item.lineTotal, t.common.rs)}
                      </span>
                    </li>
                  ))}
                </ul>

                {row.notes ? (
                  <p className="mt-3 rounded-xl bg-app px-3 py-2 text-xs text-muted">
                    <span className="font-bold text-app">Note · </span>
                    {row.notes}
                  </p>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-lg font-extrabold">{formatRs(row.amount, t.common.rs)}</p>
                  <p className="text-[11px] text-muted">{formatWhen(row.createdAt)}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    className="flex-1 cursor-pointer justify-center"
                    icon={<Check className="h-3.5 w-3.5" />}
                    disabled={actingId === row.id}
                    onClick={() => void onDeliver(row)}
                  >
                    {actingId === row.id ? "…" : "Mark delivered"}
                  </Button>
                  {row.paymentStatus === "due" ? (
                    <Button
                      size="sm"
                      variant="gold"
                      className="cursor-pointer"
                      disabled={actingId === row.id}
                      onClick={() => void onMarkPaid(row)}
                    >
                      Mark paid
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500"
                    icon={<Eye className="h-3.5 w-3.5" />}
                    onClick={() => setViewRow(row)}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="cursor-pointer"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setDeleteRow(row)}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title={viewRow ? viewRow.token : "Order"}
        subtitle={
          viewRow ? `Room ${viewRow.roomNumber} · ${viewRow.guestName}` : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewRow(null)}>
              Close
            </Button>
            {viewRow?.paymentStatus === "due" ? (
              <Button
                variant="gold"
                disabled={actingId === viewRow.id}
                onClick={() => void onMarkPaid(viewRow)}
              >
                Mark paid
              </Button>
            ) : null}
            {viewRow ? (
              <Button
                disabled={actingId === viewRow.id}
                icon={<Check className="h-4 w-4" />}
                onClick={() => void onDeliver(viewRow)}
              >
                Mark delivered
              </Button>
            ) : null}
          </>
        }
      >
        {viewRow ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Detail label="Wait time" value={formatWaitLabel(waitMinutes(viewRow.createdAt))} />
              <Detail label="Amount" value={formatRs(viewRow.amount, t.common.rs)} />
              <Detail label="Placed" value={formatWhen(viewRow.createdAt)} />
              <Detail
                label="Payment"
                value={viewRow.paymentStatus === "paid" ? "Paid" : "Due on stay"}
              />
              <Detail label="Delivery" value="Pending delivery" />
            </div>
            <ul className="space-y-1 text-sm">
              {viewRow.items.map((i, idx) => (
                <li
                  key={`${i.menuItemId}-${idx}`}
                  className="flex justify-between gap-2 rounded-lg bg-app px-3 py-2"
                >
                  <span>
                    {i.qty}× {language === "ur" && i.nameUr ? i.nameUr : i.name}
                  </span>
                  <span className="font-semibold">{formatRs(i.lineTotal, t.common.rs)}</span>
                </li>
              ))}
            </ul>
            {viewRow.notes ? (
              <p className="rounded-xl bg-app px-3 py-2 text-sm text-muted">{viewRow.notes}</p>
            ) : null}
            <p className="text-xs text-muted">
              {viewRow.paymentStatus === "paid"
                ? "Already paid at counter — still listed on the stay for the folio."
                : "Not paid yet — amount is on the guest stay balance until checkout or Mark paid."}
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteRow)}
        onClose={() => setDeleteRow(null)}
        title="Delete order?"
        subtitle={
          deleteRow
            ? `${deleteRow.token} · ${formatRs(deleteRow.amount, t.common.rs)} will be removed from Room ${deleteRow.roomNumber}’s bill.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={actingId === deleteRow?.id}
              onClick={() => void onDeleteConfirm()}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">This cannot be undone.</p>
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-app px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
