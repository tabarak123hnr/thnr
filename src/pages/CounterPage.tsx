import { Link } from "react-router-dom";
import { ClipboardList, Minus, Plus, ShoppingBag, Trash2, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Field, PageHeader, TextArea } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { cn, formatRs } from "../lib/utils";
import { subscribeCheckIns, type CheckInRecord } from "../services/checkIns";
import { subscribeMenuItems, type MenuItem } from "../services/menu";
import { createFoodOrder, subscribeOrders } from "../services/orders";
import { calcOrderAmount, type FoodOrderPaymentStatus } from "../types/order";
import { MENU_CATEGORIES } from "../types/menu";

type CartLine = {
  menuItemId: string;
  name: string;
  nameUr: string;
  unitPrice: number;
  qty: number;
};

export function CounterPage() {
  const { t, language } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();

  const [catalog, setCatalog] = useState<MenuItem[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [category, setCategory] = useState<string>("all");
  const [checkInId, setCheckInId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<FoodOrderPaymentStatus>("due");
  const [search, setSearch] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  useEffect(() => {
    const a = subscribeMenuItems(setCatalog);
    const b = subscribeCheckIns(setCheckIns);
    const c = subscribeOrders((orders) => {
      setPendingCount(orders.filter((o) => o.status === "pending").length);
    });
    return () => {
      a();
      b();
      c();
    };
  }, []);

  const inHouse = useMemo(
    () => checkIns.filter((c) => c.status === "checked_in"),
    [checkIns],
  );

  const selectedStay = inHouse.find((c) => c.id === checkInId);

  const roomOptions = useMemo(
    () =>
      inHouse.map((c) => ({
        value: c.id,
        label: `Room ${c.roomNumber} · ${c.guestName}`,
        description: c.phone || undefined,
      })),
    [inHouse],
  );

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

  const total = calcOrderAmount(cart);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  function addItem(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.menuItemId === item.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          nameUr: item.nameUr,
          unitPrice: item.price,
          qty: 1,
        },
      ];
    });
  }

  function setQty(menuItemId: string, qty: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.menuItemId === menuItemId ? { ...l, qty: Math.max(0, qty) } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function clearTicket() {
    setCart([]);
    setNotes("");
    setPaymentStatus("due");
    setPlaceError(null);
  }

  async function placeOrder() {
    setPlaceError(null);
    if (!selectedStay) {
      setPlaceError("Select an in-house room — the order bills to that guest.");
      return;
    }
    if (!cart.length) {
      setPlaceError("Tap menu items to build the ticket first.");
      return;
    }

    setPlacing(true);
    try {
      await createFoodOrder({
        roomId: selectedStay.roomId,
        roomNumber: selectedStay.roomNumber,
        checkInId: selectedStay.id,
        guestName: selectedStay.guestName,
        items: cart,
        notes,
        paymentStatus,
      });
      toastSuccess(
        "Sent to kitchen",
        `Room ${selectedStay.roomNumber} · ${formatRs(total, t.common.rs)} · ${
          paymentStatus === "paid" ? "Paid" : "Due on stay"
        }`,
      );
      clearTicket();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not place order.";
      setPlaceError(message);
      toastError("Order failed", message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.counterTitle}
        subtitle={t.pages.counterSub}
        actions={
          <Link to="/orders" className="w-full sm:w-auto">
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              icon={<ClipboardList className="h-4 w-4" />}
            >
              Kitchen queue
              {pendingCount > 0 ? (
                <span className="ms-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--warning)] px-1.5 text-[11px] font-bold text-white">
                  {pendingCount}
                </span>
              ) : null}
            </Button>
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-app bg-[color-mix(in_oklab,var(--accent)_8%,var(--surface))] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">In-house</p>
          <p className="mt-1 text-2xl font-extrabold">{inHouse.length}</p>
          <p className="text-xs text-muted">Rooms that can order</p>
        </div>
        <div className="rounded-2xl border border-app bg-app px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Menu live</p>
          <p className="mt-1 text-2xl font-extrabold">{available.length}</p>
          <p className="text-xs text-muted">Available dishes</p>
        </div>
        <div className="rounded-2xl border border-app bg-app px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Waiting kitchen</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--accent)]">{pendingCount}</p>
          <p className="text-xs text-muted">Not delivered yet</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <Card className="order-2 min-w-0 lg:order-1">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <h2 className="font-bold">Menu board</h2>
                <p className="text-xs text-muted">Tap a dish to add it to the ticket</p>
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
                  ? "bg-[var(--accent)] text-white"
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
                    ? "bg-[var(--accent)] text-white"
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
                : "No available menu items. Mark dishes available on the Menu page."}
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMenu.map((item) => {
                const inCart = cart.find((l) => l.menuItemId === item.id)?.qty ?? 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className={cn(
                      "group relative rounded-2xl border p-4 text-start transition",
                      inCart > 0
                        ? "border-[var(--accent)] bg-accent-soft shadow-sm"
                        : "border-app bg-app hover:border-[color-mix(in_oklab,var(--accent)_55%,var(--border))] hover:bg-accent-soft",
                    )}
                  >
                    {inCart > 0 ? (
                      <span className="absolute end-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-xs font-extrabold text-white">
                        {inCart}
                      </span>
                    ) : null}
                    <p className="pe-8 font-bold leading-snug">
                      {language === "ur" ? item.nameUr || item.name : item.name}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {language === "ur" ? item.categoryUr || item.category : item.category}
                      {item.prepMinutes ? ` · ${item.prepMinutes} min` : ""}
                    </p>
                    <p className="mt-3 text-sm font-extrabold text-[var(--accent)]">
                      {formatRs(item.price, t.common.rs)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="order-1 h-fit sticky top-[4.25rem] z-10 lg:order-2 lg:top-20">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <h2 className="font-bold">Current ticket</h2>
                <p className="text-xs text-muted">
                  {itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "Empty"}
                </p>
              </div>
            </div>
            {cart.length ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={clearTicket}
              >
                Clear
              </Button>
            ) : null}
          </div>

          <SelectField label="Bill to room (in-house)">
            <FancySelect
              value={checkInId}
              onChange={setCheckInId}
              placeholder={
                roomOptions.length ? "Select room / guest" : "No guests checked in"
              }
              options={roomOptions}
              disabled={!roomOptions.length}
            />
          </SelectField>

          {selectedStay ? (
            <div className="mt-3 rounded-xl border border-[color-mix(in_oklab,var(--accent)_35%,var(--border))] bg-accent-soft px-3 py-2.5 text-sm">
              <p className="font-bold">
                Room {selectedStay.roomNumber} · {selectedStay.guestName}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Food adds to stay extras (current{" "}
                {formatRs(selectedStay.extraCharges || 0, t.common.rs)})
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">
              Room service only — guest must be checked in so the order goes on their bill.
            </p>
          )}

          <div className="mt-4 max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-app px-3 py-10 text-center text-sm text-muted">
                Tap items on the menu board to build this ticket.
              </p>
            ) : (
              cart.map((line) => (
                <div
                  key={line.menuItemId}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-app bg-app px-3 py-2.5 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1 basis-[40%]">
                    <p className="truncate text-sm font-semibold">
                      {language === "ur" && line.nameUr ? line.nameUr : line.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatRs(line.unitPrice, t.common.rs)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-app hover:bg-elevated"
                      onClick={() => setQty(line.menuItemId, line.qty - 1)}
                      aria-label="Decrease"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-extrabold">{line.qty}</span>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-app hover:bg-elevated"
                      onClick={() => setQty(line.menuItemId, line.qty + 1)}
                      aria-label="Increase"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="ms-auto min-w-[4.5rem] text-end text-sm font-bold tabular-nums">
                    {formatRs(line.qty * line.unitPrice, t.common.rs)}
                  </span>
                </div>
              ))
            )}
          </div>

          <Field label="Kitchen notes" className="mt-4">
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="No onions, less spicy, deliver ASAP…"
              rows={2}
            />
          </Field>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-muted">Food payment</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentStatus("due")}
                className={cn(
                  "rounded-xl border px-3 py-3 text-start transition",
                  paymentStatus === "due"
                    ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                    : "border-app bg-app hover:bg-elevated",
                )}
              >
                <p className="text-sm font-bold">Due</p>
                <p className="mt-0.5 text-[11px] text-muted">Add to guest stay bill</p>
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus("paid")}
                className={cn(
                  "rounded-xl border px-3 py-3 text-start transition",
                  paymentStatus === "paid"
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-app bg-app hover:bg-elevated",
                )}
              >
                <p className="text-sm font-bold">Paid</p>
                <p className="mt-0.5 text-[11px] text-muted">Cash collected now</p>
              </button>
            </div>
          </div>

          {placeError ? (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {placeError}
            </p>
          ) : null}

          <div className="mt-4 border-t border-app pt-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Ticket total</p>
                <p className="text-2xl font-extrabold text-[var(--accent)]">
                  {formatRs(total, t.common.rs)}
                </p>
              </div>
              <p className="pb-1 text-xs text-muted">
                {paymentStatus === "paid" ? "Paid at counter" : "Due on guest stay"}
              </p>
            </div>
            <Button
              className="mt-4 w-full cursor-pointer justify-center"
              disabled={placing || !cart.length}
              onClick={() => void placeOrder()}
            >
              {placing
                ? "Sending…"
                : paymentStatus === "paid"
                  ? "Collect & send to kitchen"
                  : "Charge stay & send to kitchen"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
