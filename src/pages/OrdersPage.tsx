import { Check, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { EmptyState, Field, Input, PageHeader, StatCard, TextArea } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { formatRs } from "../lib/utils";
import { subscribeCheckIns, type CheckInRecord } from "../services/checkIns";
import { subscribeMenuItems, type MenuItem } from "../services/menu";
import {
  createFoodOrder,
  deleteFoodOrder,
  markOrderDelivered,
  subscribeOrders,
  updateFoodOrder,
  type FoodOrder,
  type FoodOrderStatus,
} from "../services/orders";
import { calcOrderAmount } from "../types/order";

type LineDraft = {
  menuItemId: string;
  name: string;
  nameUr?: string;
  unitPrice: number;
  qty: number;
};

const emptyForm = () => ({
  checkInId: "",
  notes: "",
  lines: [] as LineDraft[],
});

function formatWhen(value: unknown) {
  if (!value) return "—";
  let d: Date;
  if (typeof value === "string") d = new Date(value);
  else if (typeof value === "object" && value !== null && "toDate" in value) {
    d = (value as { toDate: () => Date }).toDate();
  } else return "—";
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrdersPage() {
  const { t, language } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();

  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [catalog, setCatalog] = useState<MenuItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | FoodOrderStatus>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [menuPick, setMenuPick] = useState("");
  const [qtyPick, setQtyPick] = useState("1");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewRow, setViewRow] = useState<FoodOrder | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<FoodOrder | null>(null);

  useEffect(() => {
    const a = subscribeOrders(setOrders);
    const b = subscribeCheckIns(setCheckIns);
    const c = subscribeMenuItems(setCatalog);
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

  const roomOptions = useMemo(
    () =>
      inHouse.map((c) => ({
        value: c.id,
        label: `Room ${c.roomNumber} · ${c.guestName}`,
      })),
    [inHouse],
  );

  const availableMenu = useMemo(
    () => catalog.filter((m) => m.available),
    [catalog],
  );

  const menuOptions = useMemo(
    () =>
      availableMenu.map((m) => ({
        value: m.id,
        label: `${language === "ur" ? m.nameUr : m.name} · ${formatRs(m.price, t.common.rs)}`,
      })),
    [availableMenu, language, t.common.rs],
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const pendingAmount = orders
    .filter((o) => o.status === "pending")
    .reduce((s, o) => s + o.amount, 0);

  const formTotal = calcOrderAmount(form.lines);

  const selectedStay = inHouse.find((c) => c.id === form.checkInId);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setMenuPick("");
    setQtyPick("1");
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(row: FoodOrder) {
    setEditingId(row.id);
    setForm({
      checkInId: row.checkInId,
      notes: row.notes,
      lines: row.items.map((i) => ({
        menuItemId: i.menuItemId,
        name: i.name,
        nameUr: i.nameUr,
        unitPrice: i.unitPrice,
        qty: i.qty,
      })),
    });
    setMenuPick("");
    setQtyPick("1");
    setFormError(null);
    setFormOpen(true);
  }

  function addLine() {
    const item = availableMenu.find((m) => m.id === menuPick);
    if (!item) return;
    const addQty = Math.max(1, Math.floor(Number(qtyPick) || 1));
    setForm((p) => {
      const existing = p.lines.find((l) => l.menuItemId === item.id);
      if (existing) {
        return {
          ...p,
          lines: p.lines.map((l) =>
            l.menuItemId === item.id ? { ...l, qty: l.qty + addQty } : l,
          ),
        };
      }
      return {
        ...p,
        lines: [
          ...p.lines,
          {
            menuItemId: item.id,
            name: item.name,
            nameUr: item.nameUr,
            unitPrice: item.price,
            qty: addQty,
          },
        ],
      };
    });
    setMenuPick("");
    setQtyPick("1");
  }

  function setQty(menuItemId: string, qty: number) {
    setForm((p) => ({
      ...p,
      lines: p.lines
        .map((l) => (l.menuItemId === menuItemId ? { ...l, qty: Math.max(0, qty) } : l))
        .filter((l) => l.qty > 0),
    }));
  }

  async function onSave() {
    setFormError(null);
    if (!editingId && !form.checkInId) {
      setFormError("Select the guest room — food is billed to that stay.");
      return;
    }
    if (!form.lines.length) {
      setFormError("Add at least one dish.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateFoodOrder(editingId, {
          items: form.lines,
          notes: form.notes,
        });
        toastSuccess("Order updated", "Guest bill extras were adjusted.");
      } else {
        const stay = inHouse.find((c) => c.id === form.checkInId);
        if (!stay) {
          setFormError("That room is no longer checked in.");
          return;
        }
        await createFoodOrder({
          roomId: stay.roomId,
          roomNumber: stay.roomNumber,
          checkInId: stay.id,
          guestName: stay.guestName,
          items: form.lines,
          notes: form.notes,
        });
        toastSuccess(
          "Order placed",
          `Room ${stay.roomNumber} · ${formatRs(formTotal, t.common.rs)} added to guest bill`,
        );
      }
      setFormOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save order.";
      setFormError(message);
      toastError("Order failed", message);
    } finally {
      setSaving(false);
    }
  }

  async function onDeliver(row: FoodOrder) {
    setActingId(row.id);
    try {
      await markOrderDelivered(row.id);
      toastSuccess("Delivered", `${row.token} · Room ${row.roomNumber}`);
    } catch (err) {
      toastError(
        "Could not mark delivered",
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
      toastSuccess("Order deleted", "Amount removed from guest bill extras.");
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
        subtitle="Orders are tied to the room’s active check-in so food is added to that guest’s bill (room + extras)."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t.newOrder}
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Pending"
          value={String(pendingCount)}
          hint={formatRs(pendingAmount, t.common.rs)}
          alert={pendingCount || undefined}
        />
        <StatCard label="Delivered" value={String(deliveredCount)} />
        <StatCard
          label="In-house rooms"
          value={String(inHouse.length)}
          hint="Can place room service"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["pending", "Pending"],
            ["delivered", "Delivered"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={statusFilter === value ? "primary" : "secondary"}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState message="No orders yet. Create one for an in-house room." />
        ) : (
          <Table
            headers={[
              "Token",
              "Room / guest",
              t.items,
              t.common.amount,
              t.status,
              "Placed",
              t.common.actions,
            ]}
          >
            {filtered.map((row) => (
              <Tr key={row.id}>
                <Td className="font-bold">{row.token}</Td>
                <Td>
                  <div className="font-semibold">Room {row.roomNumber}</div>
                  <div className="text-xs text-muted">{row.guestName}</div>
                </Td>
                <Td className="max-w-xs text-sm">
                  {row.items
                    .map(
                      (i) =>
                        `${i.qty}× ${language === "ur" && i.nameUr ? i.nameUr : i.name}`,
                    )
                    .join(", ")}
                </Td>
                <Td className="font-semibold">{formatRs(row.amount, t.common.rs)}</Td>
                <Td>
                  <Badge tone={row.status === "pending" ? "warning" : "success"}>
                    {row.status === "pending" ? "Pending" : "Delivered"}
                  </Badge>
                </Td>
                <Td className="text-muted text-sm">{formatWhen(row.createdAt)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500 hover:!shadow-md"
                      icon={<Eye className="h-3.5 w-3.5" />}
                      onClick={() => setViewRow(row)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="gold"
                      className="cursor-pointer"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </Button>
                    {row.status === "pending" ? (
                      <Button
                        size="sm"
                        className="cursor-pointer"
                        icon={<Check className="h-3.5 w-3.5" />}
                        disabled={actingId === row.id}
                        onClick={() => onDeliver(row)}
                      >
                        Delivered
                      </Button>
                    ) : null}
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
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editingId ? "Edit order" : "New room order"}
        subtitle="Select room by active check-in — guest name is filled from that stay."
        wide
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button disabled={saving} onClick={onSave}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Place order"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}

          {!editingId ? (
            <SelectField label="Room (in-house)">
              <FancySelect
                value={form.checkInId}
                onChange={(checkInId) => setForm((p) => ({ ...p, checkInId }))}
                placeholder={
                  roomOptions.length ? "Select room / guest" : "No guests checked in"
                }
                options={roomOptions}
                disabled={!roomOptions.length}
              />
            </SelectField>
          ) : (
            <div className="rounded-xl bg-app px-3 py-2 text-sm">
              <span className="text-muted">Room </span>
              <span className="font-bold">
                {orders.find((o) => o.id === editingId)?.roomNumber}
              </span>
              <span className="text-muted"> · </span>
              <span className="font-semibold">
                {orders.find((o) => o.id === editingId)?.guestName}
              </span>
            </div>
          )}

          {selectedStay && !editingId ? (
            <p className="text-xs text-muted">
              Billing to <strong>{selectedStay.guestName}</strong> — food adds to stay extras (
              current extras {formatRs(selectedStay.extraCharges || 0, t.common.rs)}).
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[1fr_6.5rem_auto]">
            <SelectField label="Add dish">
              <FancySelect
                value={menuPick}
                onChange={setMenuPick}
                placeholder="Choose from menu"
                options={menuOptions}
              />
            </SelectField>
            <Field label="Quantity">
              <Input
                type="number"
                min={1}
                step={1}
                value={qtyPick}
                onChange={(e) => setQtyPick(e.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="secondary" disabled={!menuPick} onClick={addLine}>
                Add
              </Button>
            </div>
          </div>

          {form.lines.length ? (
            <ul className="space-y-2">
              {form.lines.map((line) => (
                <li
                  key={line.menuItemId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-app px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {language === "ur" && line.nameUr ? line.nameUr : line.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatRs(line.unitPrice, t.common.rs)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Field label="Qty" className="w-20">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={line.qty}
                        onChange={(e) =>
                          setQty(line.menuItemId, Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <span className="w-24 self-end pb-2 text-end text-sm font-bold">
                      {formatRs(line.qty * line.unitPrice, t.common.rs)}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="self-end mb-0.5"
                      onClick={() => setQty(line.menuItemId, 0)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-app px-3 py-6 text-center text-sm text-muted">
              No dishes yet — pick from the menu above.
            </p>
          )}

          <div className="rounded-2xl border border-app bg-accent-soft px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
              Order total (goes on guest bill)
            </p>
            <p className="mt-1 text-xl font-extrabold text-[var(--accent)]">
              {formatRs(formTotal, t.common.rs)}
            </p>
          </div>

          <Field label="Notes (optional)">
            <TextArea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="No onions, deliver to room…"
              rows={2}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title={viewRow ? viewRow.token : "Order"}
        subtitle={
          viewRow
            ? `Room ${viewRow.roomNumber} · ${viewRow.guestName}`
            : undefined
        }
        footer={
          <Button variant="secondary" onClick={() => setViewRow(null)}>
            Close
          </Button>
        }
      >
        {viewRow ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Detail
                label="Status"
                value={viewRow.status === "pending" ? "Pending" : "Delivered"}
              />
              <Detail label="Amount" value={formatRs(viewRow.amount, t.common.rs)} />
              <Detail label="Placed" value={formatWhen(viewRow.createdAt)} />
              <Detail
                label="Delivered"
                value={viewRow.deliveredAt ? formatWhen(viewRow.deliveredAt) : "—"}
              />
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
                  <span className="font-semibold">
                    {formatRs(i.lineTotal, t.common.rs)}
                  </span>
                </li>
              ))}
            </ul>
            {viewRow.notes ? (
              <p className="rounded-xl bg-app px-3 py-2 text-sm text-muted">{viewRow.notes}</p>
            ) : null}
            <p className="text-xs text-muted">
              This amount is included in the guest’s stay extras / total bill for check-in{" "}
              <code className="text-[11px]">{viewRow.checkInId.slice(0, 8)}…</code>
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
              disabled={actingId === deleteRow?.id}
              onClick={onDeleteConfirm}
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
