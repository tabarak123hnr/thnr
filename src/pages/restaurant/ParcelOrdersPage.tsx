import { Eye, Printer, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { EmptyState, PageHeader } from "../../components/ui/Page";
import { Table, Td, Tr } from "../../components/ui/Table";
import { useApp } from "../../context/app-context";
import { useToast } from "../../context/toast-context";
import { printParcelChits } from "../../lib/parcelChits";
import { formatRs } from "../../lib/utils";
import { subscribeParcelOrders, type ParcelOrder } from "../../services/parcels";
import {
  parcelLineQty,
  parcelLineTotal,
  parcelOrderUnits,
  type ParcelOrderStatus,
} from "../../types/parcel";

function tsMs(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const fn = (value as { toMillis?: () => number }).toMillis;
    if (typeof fn === "function") return fn.call(value) || 0;
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const sec = Number((value as { seconds: number }).seconds);
    return Number.isFinite(sec) ? sec * 1000 : 0;
  }
  return 0;
}

function formatWhen(value: unknown) {
  const ms = tsMs(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const statusLabel: Record<ParcelOrderStatus, string> = {
  open: "Open",
  preparing: "Preparing",
  ready: "Ready",
  handed_over: "Handed over",
  cancelled: "Cancelled",
};

const statusTone: Record<
  ParcelOrderStatus,
  "gold" | "info" | "success" | "muted" | "danger"
> = {
  open: "gold",
  preparing: "info",
  ready: "success",
  handed_over: "muted",
  cancelled: "danger",
};

export function ParcelOrdersPage() {
  const { t } = useApp();
  const { error: toastError } = useToast();
  const [orders, setOrders] = useState<ParcelOrder[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ParcelOrder | null>(null);

  useEffect(() => {
    return subscribeParcelOrders(setOrders);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const hay = [
        o.token,
        o.customerName,
        o.customerPhone,
        o.notes,
        ...o.lines.map((l) => l.name),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, search]);

  function reprint(order: ParcelOrder) {
    try {
      printParcelChits({
        token: order.token,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        notes: order.notes,
        paymentStatus: order.paymentStatus,
        lines: order.lines,
        amount: order.amount,
        rs: t.common.rs,
        brand: t.brand,
      });
    } catch (err) {
      toastError(
        "Print failed",
        err instanceof Error ? err.message : "Allow pop-ups to print.",
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="Parcel orders"
        subtitle="Every parcel saved here — open any order to see dishes, chits, and totals."
        actions={
          <Link to="/restaurant/parcel">
            <Button variant="gold">New parcel</Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search token, guest, phone, dish…"
            className="h-10 w-full rounded-xl border border-app bg-elevated ps-9 pe-9 text-sm outline-none ring-accent focus:ring-2"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="All orders"
          badge={<Badge tone="muted">{filtered.length}</Badge>}
        />
        {filtered.length === 0 ? (
          <EmptyState
            message={
              search
                ? "No orders match your search."
                : "No parcel orders yet. Create one from the parcel counter."
            }
          />
        ) : (
          <Table
            headers={[
              "Order",
              "When",
              "Guest",
              "Chits",
              "Units",
              "Total",
              "Payment",
              "Status",
              "Actions",
            ]}
            colWidths={["10%", "14%", "16%", "8%", "8%", "12%", "10%", "12%", "10%"]}
          >
            {filtered.map((order) => (
              <Tr key={order.id}>
                <Td className="font-bold">{order.token}</Td>
                <Td className="text-xs text-muted">{formatWhen(order.createdAt)}</Td>
                <Td>
                  <p className="font-medium">{order.customerName || "Walk-in"}</p>
                  {order.customerPhone ? (
                    <p className="text-xs text-muted">{order.customerPhone}</p>
                  ) : null}
                </Td>
                <Td>{order.lines.length}</Td>
                <Td>{parcelOrderUnits(order.lines)}</Td>
                <Td className="font-semibold tabular-nums">
                  {formatRs(order.amount, t.common.rs)}
                </Td>
                <Td>
                  <Badge tone={order.paymentStatus === "paid" ? "success" : "warning"}>
                    {order.paymentStatus === "paid" ? "Paid" : "Due"}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={statusTone[order.status]}>{statusLabel[order.status]}</Badge>
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setView(order)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => reprint(order)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={view != null}
        title={view ? `Order ${view.token}` : "Order"}
        subtitle={view ? formatWhen(view.createdAt) : undefined}
        onClose={() => setView(null)}
        footer={
          view ? (
            <>
              <Button variant="secondary" onClick={() => setView(null)}>
                Close
              </Button>
              <Button variant="gold" onClick={() => reprint(view)}>
                <Printer className="h-4 w-4" />
                Reprint chits
              </Button>
            </>
          ) : null
        }
      >
        {view ? (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted">Guest: </span>
                <span className="font-semibold">{view.customerName || "Walk-in"}</span>
              </p>
              <p>
                <span className="text-muted">Phone: </span>
                {view.customerPhone || "—"}
              </p>
              <p>
                <span className="text-muted">Payment: </span>
                {view.paymentStatus === "paid" ? "Paid" : "Due"}
              </p>
              <p>
                <span className="text-muted">Status: </span>
                {statusLabel[view.status]}
              </p>
            </div>
            {view.notes ? (
              <p className="rounded-xl border border-app bg-app px-3 py-2 text-sm text-muted">
                {view.notes}
              </p>
            ) : null}
            <ul className="space-y-2">
              {view.lines.map((line) => (
                <li
                  key={line.lineId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-app bg-app px-3 py-2.5"
                >
                  <div>
                    <p className="font-semibold">{line.name}</p>
                    <p className="text-xs text-muted">
                      Chit {line.chitNo} · Qty {parcelLineQty(line)} ·{" "}
                      {formatRs(line.unitPrice, t.common.rs)} each
                    </p>
                  </div>
                  <p className="font-bold tabular-nums">
                    {formatRs(parcelLineTotal(line), t.common.rs)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-end text-lg font-extrabold tabular-nums">
              Total {formatRs(view.amount, t.common.rs)}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
