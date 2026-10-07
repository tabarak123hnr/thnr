import {
  Minus,
  Package,
  Plus,
  Printer,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FancySelect } from "../../components/ui/FancySelect";
import { Field, Input, PageHeader, TextArea } from "../../components/ui/Page";
import { useApp } from "../../context/app-context";
import { useToast } from "../../context/toast-context";
import { printParcelChits } from "../../lib/parcelChits";
import { cn, formatRs } from "../../lib/utils";
import { subscribeMenuItems, type MenuItem } from "../../services/menu";
import {
  createParcelOrder,
  subscribeParcelOrders,
  type ParcelOrder,
} from "../../services/parcels";
import { MENU_CATEGORIES } from "../../types/menu";
import type { ParcelPaymentStatus } from "../../types/parcel";

type CartLine = {
  lineId: string;
  menuItemId: string;
  name: string;
  nameUr: string;
  unitPrice: number;
};

function newLineId() {
  return `L-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ParcelPage() {
  const { t, language } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();

  const [catalog, setCatalog] = useState<MenuItem[]>([]);
  const [recent, setRecent] = useState<ParcelOrder[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<ParcelPaymentStatus>("paid");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  useEffect(() => {
    const a = subscribeMenuItems(setCatalog);
    const b = subscribeParcelOrders((rows) => setRecent(rows.slice(0, 8)));
    return () => {
      a();
      b();
    };
  }, []);

  const available = useMemo(() => catalog.filter((m) => m.available), [catalog]);

  const categoriesInMenu = useMemo(() => {
    const present = new Set(available.map((m) => m.category));
    return MENU_CATEGORIES.filter((c) => present.has(c.value));
  }, [available]);

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    return available.filter((m) => {
      if (category !== "all" && m.category !== category) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.nameUr.includes(search.trim()) ||
        m.category.toLowerCase().includes(q)
      );
    });
  }, [available, category, search]);

  const total = cart.reduce((s, l) => s + l.unitPrice, 0);
  const itemCount = cart.length;

  /** Each click = one separate chit line (even if same dish). */
  function addItem(item: MenuItem) {
    setCart((prev) => [
      ...prev,
      {
        lineId: newLineId(),
        menuItemId: item.id,
        name: item.name,
        nameUr: item.nameUr,
        unitPrice: item.price,
      },
    ]);
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  function clearTicket() {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setNotes("");
    setPaymentStatus("paid");
    setPlaceError(null);
  }

  async function placeAndPrint() {
    setPlaceError(null);
    if (!cart.length) {
      setPlaceError("Tap menu items to build the parcel bill.");
      return;
    }

    setPlacing(true);
    try {
      const created = await createParcelOrder({
        channel: "parcel",
        customerName,
        customerPhone,
        notes,
        paymentStatus,
        lines: cart,
      });

      printParcelChits({
        token: created.token,
        customerName,
        customerPhone,
        notes,
        paymentStatus,
        lines: created.lines,
        amount: created.amount,
        rs: t.common.rs,
        brand: t.brand,
      });

      toastSuccess(
        "Parcel ready",
        `${created.token} · ${created.lines.length} chit${
          created.lines.length === 1 ? "" : "s"
        } · ${formatRs(created.amount, t.common.rs)}`,
      );
      clearTicket();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create parcel order.";
      setPlaceError(message);
      toastError("Parcel failed", message);
    } finally {
      setPlacing(false);
    }
  }

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

  const lineCountByMenu = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) {
      map.set(line.menuItemId, (map.get(line.menuItemId) || 0) + 1);
    }
    return map;
  }, [cart]);

  return (
    <div>
      <PageHeader
        title="Parcel counter"
        subtitle="Tap dishes to add. Bill is combined — each item prints as its own chit."
        actions={
          <Badge tone="gold">
            <Package className="me-1 h-3.5 w-3.5" />
            Parcel
          </Badge>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-app bg-[color-mix(in_oklab,var(--accent)_8%,var(--bg))] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            On this bill
          </p>
          <p className="mt-1 text-2xl font-extrabold">{itemCount}</p>
          <p className="text-xs text-muted">Separate chits</p>
        </div>
        <div className="rounded-2xl border border-app bg-app px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Combined total
          </p>
          <p className="mt-1 text-2xl font-extrabold">
            {formatRs(total, t.common.rs)}
          </p>
          <p className="text-xs text-muted">All items together</p>
        </div>
        <div className="rounded-2xl border border-app bg-app px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Menu live
          </p>
          <p className="mt-1 text-2xl font-extrabold">{available.length}</p>
          <p className="text-xs text-muted">Available dishes</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <Card className="order-2 min-w-0 lg:order-1">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <h2 className="font-bold">Menu board</h2>
                <p className="text-xs text-muted">
                  Each tap adds one separate item for kitchen chits
                </p>
              </div>
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes…"
              className="h-10 w-full rounded-xl border border-app bg-elevated px-3 text-sm outline-none ring-accent focus:ring-2 sm:max-w-56"
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold transition",
                category === "all"
                  ? "bg-[var(--accent)] text-[var(--accent-text)]"
                  : "border border-app bg-app text-muted hover:text-app",
              )}
            >
              All
            </button>
            {categoriesInMenu.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition",
                  category === c.value
                    ? "bg-[var(--accent)] text-[var(--accent-text)]"
                    : "border border-app bg-app text-muted hover:text-app",
                )}
              >
                {language === "ur" ? c.labelUr : c.label}
              </button>
            ))}
          </div>

          {filteredMenu.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-app px-4 py-12 text-center text-sm text-muted">
              {available.length
                ? "No dishes match this filter."
                : "No available menu items. Mark dishes available on the hotel Menu page."}
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredMenu.map((item) => {
                const count = lineCountByMenu.get(item.id) || 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className={cn(
                      "group relative rounded-2xl border p-4 text-start transition",
                      count > 0
                        ? "border-[var(--accent)] bg-accent-soft shadow-sm"
                        : "border-app bg-app hover:border-[color-mix(in_oklab,var(--accent)_55%,var(--border))] hover:bg-accent-soft",
                    )}
                  >
                    {count > 0 ? (
                      <span className="absolute end-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-xs font-extrabold text-[var(--accent-text)]">
                        {count}
                      </span>
                    ) : null}
                    <p className="pe-8 font-bold leading-snug">
                      {language === "ur" ? item.nameUr || item.name : item.name}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {language === "ur"
                        ? item.categoryUr || item.category
                        : item.category}
                    </p>
                    <p className="mt-3 text-sm font-extrabold text-[var(--accent)]">
                      {formatRs(item.price, t.common.rs)}
                    </p>
                    <p className="mt-2 text-[11px] text-muted">
                      <Plus className="me-0.5 inline h-3 w-3" />
                      Add as separate chit
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="order-1 h-fit sticky top-[4.5rem] z-10 lg:order-2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <h2 className="font-bold">Parcel bill</h2>
                <p className="text-xs text-muted">
                  {itemCount
                    ? `${itemCount} separate item${itemCount === 1 ? "" : "s"}`
                    : "Empty"}
                </p>
              </div>
            </div>
            {cart.length ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearTicket}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Clear
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Customer name (optional)">
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in guest"
              />
            </Field>
            <Field label="Phone (optional)">
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="03xx…"
              />
            </Field>
          </div>

          <Field label="Payment" className="mt-3">
            <FancySelect
              value={paymentStatus}
              onChange={(v) => setPaymentStatus(v as ParcelPaymentStatus)}
              options={[
                { value: "paid", label: "Paid at counter" },
                { value: "due", label: "Due / unpaid" },
              ]}
            />
          </Field>

          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="rounded-xl border border-dashed border-app px-3 py-8 text-center text-sm text-muted">
                Tap dishes on the left. Same dish twice = two chits.
              </p>
            ) : (
              cart.map((line, index) => (
                <div
                  key={line.lineId}
                  className="flex items-center gap-2 rounded-xl border border-app bg-app px-3 py-2.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-extrabold text-[var(--accent)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {language === "ur" ? line.nameUr || line.name : line.name}
                    </p>
                    <p className="text-xs text-muted">
                      Separate chit · {formatRs(line.unitPrice, t.common.rs)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.lineId)}
                    className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-app"
                    title="Remove this chit"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <Field label="Notes" className="mt-3">
            <TextArea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Extra spicy, no onion…"
            />
          </Field>

          <div className="mt-4 flex items-center justify-between border-t border-app pt-3">
            <span className="text-sm font-semibold text-muted">Combined total</span>
            <span className="text-xl font-extrabold tabular-nums">
              {formatRs(total, t.common.rs)}
            </span>
          </div>

          {placeError ? (
            <p className="mt-3 text-sm font-medium text-red-600">{placeError}</p>
          ) : null}

          <Button
            variant="gold"
            className="mt-4 w-full"
            disabled={placing || !cart.length}
            onClick={() => void placeAndPrint()}
          >
            <Printer className="h-4 w-4" />
            {placing ? "Saving…" : "Confirm & print chits"}
          </Button>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-bold">Recent parcels</h2>
          <p className="text-xs text-muted">Reprint chits anytime</p>
        </div>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            No parcel orders yet. Place the first one above.
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app bg-app px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-bold">
                    {order.token}{" "}
                    <span className="font-medium text-muted">
                      · {order.lines.length} chit
                      {order.lines.length === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {order.customerName || "Walk-in"}
                    {order.customerPhone ? ` · ${order.customerPhone}` : ""}
                    {" · "}
                    {formatRs(order.amount, t.common.rs)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={order.paymentStatus === "paid" ? "success" : "warning"}>
                    {order.paymentStatus === "paid" ? "Paid" : "Due"}
                  </Badge>
                  <Button size="sm" variant="secondary" onClick={() => reprint(order)}>
                    <Printer className="h-3.5 w-3.5" />
                    Reprint
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
