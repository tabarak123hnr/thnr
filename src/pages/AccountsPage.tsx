import {
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FancySelect } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { EmptyState, Field, Input, PageHeader, StatCard, TextArea } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import {
  buildAccountsSnapshot,
  checkoutGapFlags,
  dateStringInRange,
  listCheckoutsInPeriod,
  listOpenBalanceStays,
  rangeForPeriod,
  todayIsoDate,
  type AccountsPeriod,
  type CheckoutGapFlag,
} from "../lib/accountsFinance";
import { downloadCsv, toCsv } from "../lib/exportSpreadsheet";
import {
  paymentPlanLabel,
  paymentStatusLabel,
  paymentStatusTone,
} from "../lib/paymentDisplay";
import { cn, formatRs } from "../lib/utils";
import { fetchCheckIns, subscribeCheckIns, type CheckInRecord } from "../services/checkIns";
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  subscribeExpenses,
  updateExpense,
  type ExpenseRecord,
} from "../services/expenses";
import { fetchOrders, markStayFoodOrdersPaid, subscribeOrders, type FoodOrder } from "../services/orders";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_LABELS,
  EXPENSE_PAYMENT_METHODS,
  type ExpenseCategory,
  type ExpensePaymentMethod,
} from "../types/expense";

type TabId = "overview" | "expenses" | "revenue";

const emptyForm = () => ({
  title: "",
  category: "supplies" as ExpenseCategory,
  amount: "",
  date: todayIsoDate(),
  paymentMethod: "cash" as ExpensePaymentMethod,
  vendor: "",
  notes: "",
  recordedBy: "",
});

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AccountsPage() {
  const { t } = useApp();
  const { profile, user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const a = t.accounts;

  const staffName = profile?.name || user?.displayName || "";

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [period, setPeriod] = useState<AccountsPeriod>("month");
  const [tab, setTab] = useState<TabId>("overview");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ExpenseCategory>("all");
  const [refreshing, setRefreshing] = useState(false);

  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const u1 = subscribeCheckIns(setCheckIns);
    const u2 = subscribeOrders(setOrders);
    const u3 = subscribeExpenses(setExpenses);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  // One-time heal: settled checkouts should not leave kitchen tickets as "due"
  useEffect(() => {
    const settled = checkIns.filter(
      (c) =>
        c.status === "checked_out" &&
        (Math.max(0, Number(c.balanceDue) || 0) <= 0 || c.paymentStatus === "paid"),
    );
    if (!settled.length) return;
    const dueOnSettled = orders.filter(
      (o) =>
        o.paymentStatus === "due" &&
        o.checkInId &&
        settled.some((c) => c.id === o.checkInId),
    );
    if (!dueOnSettled.length) return;
    const ids = [...new Set(dueOnSettled.map((o) => o.checkInId))];
    void Promise.all(ids.map((id) => markStayFoodOrdersPaid(id).catch(() => 0)));
  }, [checkIns, orders]);

  const range = useMemo(() => rangeForPeriod(period), [period]);

  const snapshot = useMemo(
    () => buildAccountsSnapshot(checkIns, orders, expenses, range),
    [checkIns, orders, expenses, range],
  );

  const periodExpenses = useMemo(
    () => expenses.filter((e) => dateStringInRange(e.date, range)),
    [expenses, range],
  );

  const periodCheckouts = useMemo(
    () => listCheckoutsInPeriod(checkIns, range),
    [checkIns, range],
  );

  const openBalanceStays = useMemo(
    () => listOpenBalanceStays(checkIns),
    [checkIns],
  );

  const filteredExpenses = useMemo(() => {
    if (categoryFilter === "all") return periodExpenses;
    return periodExpenses.filter((e) => e.category === categoryFilter);
  }, [periodExpenses, categoryFilter]);

  function gapLabel(flag: CheckoutGapFlag): string {
    switch (flag) {
      case "owes_balance":
        return a.flagOwes;
      case "partial_plan":
        return a.flagPartial;
      case "due_on_checkout":
        return a.flagDueCheckout;
      case "paid_covers_extras":
        return a.flagCoversExtras;
      case "paid_below_room":
        return a.flagBelowRoom;
      case "paid_above_room":
        return a.flagAboveRoom;
      case "fully_settled":
        return a.flagSettled;
      default:
        return flag;
    }
  }

  function gapTone(
    flag: CheckoutGapFlag,
  ): "danger" | "warning" | "info" | "gold" | "success" | "muted" {
    switch (flag) {
      case "owes_balance":
      case "paid_below_room":
        return "danger";
      case "partial_plan":
      case "due_on_checkout":
        return "warning";
      case "paid_covers_extras":
      case "paid_above_room":
        return "info";
      case "fully_settled":
        return "success";
      default:
        return "muted";
    }
  }

  const maxCategory = snapshot.byCategory[0]?.amount || 0;

  async function onRefresh() {
    setRefreshing(true);
    try {
      const [nextCheckIns, nextOrders, nextExpenses] = await Promise.all([
        fetchCheckIns(),
        fetchOrders(),
        fetchExpenses(),
      ]);
      setCheckIns(nextCheckIns);
      setOrders(nextOrders);
      setExpenses(nextExpenses);
      toastSuccess(a.refreshed, a.refreshedSub);
    } catch (err) {
      toastError(
        a.refreshFailed,
        err instanceof Error ? err.message : a.refreshFailedSub,
      );
    } finally {
      setRefreshing(false);
    }
  }

  function openCreate() {
    setForm({ ...emptyForm(), recordedBy: staffName });
    setFormError(null);
    setEditingId(null);
    setMode("create");
  }

  function openEdit(row: ExpenseRecord) {
    setForm({
      title: row.title,
      category: row.category,
      amount: String(row.amount),
      date: row.date.slice(0, 10),
      paymentMethod: row.paymentMethod,
      vendor: row.vendor,
      notes: row.notes,
      recordedBy: row.recordedBy || staffName,
    });
    setFormError(null);
    setEditingId(row.id);
    setMode("edit");
  }

  async function onSave() {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title,
        category: form.category,
        amount: Number(form.amount),
        date: form.date,
        paymentMethod: form.paymentMethod,
        vendor: form.vendor,
        notes: form.notes,
        recordedBy: form.recordedBy || staffName,
      };
      if (mode === "edit" && editingId) {
        await updateExpense(editingId, payload);
        toastSuccess(a.expenseUpdated, form.title);
      } else {
        await createExpense(payload);
        toastSuccess(a.expenseAdded, form.title);
      }
      setMode(null);
      setEditingId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : a.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteId);
      toastSuccess(a.expenseDeleted, a.expenseDeletedSub);
      setDeleteId(null);
    } catch (err) {
      toastError(
        a.deleteFailed,
        err instanceof Error ? err.message : a.deleteFailedSub,
      );
    } finally {
      setDeleting(false);
    }
  }

  function onExportExpenses() {
    if (!filteredExpenses.length) {
      toastError(a.nothingToExport, a.noExpensesMatch);
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `tabarak-expenses-${stamp}.csv`,
      toCsv(filteredExpenses, [
        { header: "Date", value: (r) => r.date },
        { header: "Title", value: (r) => r.title },
        {
          header: "Category",
          value: (r) => EXPENSE_CATEGORY_LABELS[r.category],
        },
        { header: "Amount", value: (r) => r.amount },
        {
          header: "Payment",
          value: (r) => EXPENSE_PAYMENT_LABELS[r.paymentMethod],
        },
        { header: "Vendor", value: (r) => r.vendor },
        { header: "Recorded by", value: (r) => r.recordedBy },
        { header: "Notes", value: (r) => r.notes },
      ]),
    );
    toastSuccess(a.exported, a.exportedSub);
  }

  const periodOptions: { id: AccountsPeriod; label: string }[] = [
    { id: "today", label: a.periodToday },
    { id: "week", label: a.periodWeek },
    { id: "month", label: a.periodMonth },
    { id: "all", label: a.periodAll },
  ];

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: a.tabOverview },
    { id: "expenses", label: a.tabExpenses },
    { id: "revenue", label: a.tabRevenue },
  ];

  const profitPositive = snapshot.profit >= 0;

  return (
    <div>
      <PageHeader
        title={t.pages.accountsTitle}
        subtitle={t.pages.accountsSub}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void onRefresh()}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {a.refresh}
            </Button>
            <Button variant="secondary" onClick={onExportExpenses}>
              {t.common.export}
            </Button>
            <Button variant="gold" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {a.addExpense}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {periodOptions.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={period === p.id ? "gold" : "secondary"}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={a.revenue}
          value={formatRs(snapshot.revenue, t.common.rs)}
          hint={`${a.room}: ${formatRs(snapshot.roomRevenue, t.common.rs)} · ${a.food}: ${formatRs(snapshot.foodRevenue, t.common.rs)}`}
        />
        <StatCard
          label={a.expenditures}
          value={formatRs(snapshot.expenditures, t.common.rs)}
          hint={`${snapshot.expenseCount} ${a.entries}`}
        />
        <StatCard
          label={a.profit}
          value={formatRs(snapshot.profit, t.common.rs)}
          hint={profitPositive ? a.profitHint : a.lossHint}
        />
        <StatCard
          label={a.outstanding}
          value={formatRs(snapshot.toBePaid, t.common.rs)}
          hint={`${a.collected}: ${formatRs(snapshot.collected, t.common.rs)}${
            snapshot.partialStayCount
              ? ` · ${a.partials}: ${snapshot.partialStayCount}`
              : ""
          }`}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-app pb-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              tab === item.id
                ? "bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--accent)]"
                : "text-muted hover:bg-app hover:text-app",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={a.revenueBreakdown} />
            <ul className="space-y-3">
              {[
                {
                  label: a.roomRevenue,
                  value: snapshot.roomRevenue,
                  meta: `${snapshot.checkoutCount} ${a.checkouts}`,
                  tone: "gold" as const,
                },
                {
                  label: a.foodRevenue,
                  value: snapshot.foodRevenue,
                  meta: `${snapshot.orderCount} ${a.orders}`,
                  tone: "info" as const,
                },
                {
                  label: a.foodPaid,
                  value: snapshot.foodPaid,
                  meta: a.paidOrders,
                  tone: "success" as const,
                },
                {
                  label: a.foodDue,
                  value: snapshot.foodDue,
                  meta: a.unpaidOrders,
                  tone: "danger" as const,
                },
              ].map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-app bg-app px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted">{row.meta}</p>
                  </div>
                  <Badge tone={row.tone}>{formatRs(row.value, t.common.rs)}</Badge>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-app px-4 py-3">
              {profitPositive ? (
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <p className="text-sm">
                <span className="font-semibold">{a.netResult}: </span>
                <span className={profitPositive ? "text-emerald-700" : "text-red-700"}>
                  {formatRs(snapshot.profit, t.common.rs)}
                </span>
                <span className="text-muted">
                  {" "}
                  ({a.revenue} − {a.expenditures})
                </span>
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title={a.settlementTitle} />
            <p className="mb-3 text-sm text-muted">{a.settlementSub}</p>
            <ul className="space-y-3">
              {[
                {
                  label: a.cashCollected,
                  value: snapshot.collected,
                  meta: a.stayCollectedHint,
                  tone: "success" as const,
                },
                {
                  label: a.toBePaid,
                  value: snapshot.toBePaid,
                  meta: a.outstanding,
                  tone: "danger" as const,
                },
                {
                  label: a.partialPaidLabel,
                  value: snapshot.partialPaid,
                  meta: `${snapshot.partialStayCount} ${a.partials}`,
                  tone: "warning" as const,
                },
                {
                  label: a.partialDueLabel,
                  value: snapshot.partialDue,
                  meta: a.partials,
                  tone: "gold" as const,
                },
              ].map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-app bg-app px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted">{row.meta}</p>
                  </div>
                  <Badge tone={row.tone}>{formatRs(row.value, t.common.rs)}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title={a.expenseByCategory} />
            {snapshot.byCategory.length === 0 ? (
              <EmptyState message={`${a.noExpenses} ${a.noExpensesSub}`} />
            ) : (
              <ul className="space-y-3">
                {snapshot.byCategory.map((row) => {
                  const pct = maxCategory
                    ? Math.max(6, Math.round((row.amount / maxCategory) * 100))
                    : 0;
                  return (
                    <li key={row.category}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">
                          {EXPENSE_CATEGORY_LABELS[row.category]}
                        </span>
                        <span className="tabular-nums text-muted">
                          {formatRs(row.amount, t.common.rs)} · {row.count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-app">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "expenses" ? (
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={categoryFilter === "all" ? "gold" : "secondary"}
              onClick={() => setCategoryFilter("all")}
            >
              {t.common.all}
            </Button>
            {EXPENSE_CATEGORIES.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={categoryFilter === cat ? "gold" : "secondary"}
                onClick={() => setCategoryFilter(cat)}
              >
                {EXPENSE_CATEGORY_LABELS[cat]}
              </Button>
            ))}
          </div>

          <Card>
            {filteredExpenses.length === 0 ? (
              <EmptyState message={`${a.noExpenses} ${a.noExpensesSub}`} />
            ) : (
              <Table
                headers={[
                  t.common.date,
                  a.title,
                  t.common.type,
                  t.common.amount,
                  a.payment,
                  a.vendor,
                  t.common.actions,
                ]}
                colWidths={["12%", "22%", "14%", "12%", "12%", "14%", "14%"]}
              >
                {filteredExpenses.map((row) => (
                  <Tr key={row.id}>
                    <Td>{formatDate(row.date)}</Td>
                    <Td>
                      <p className="font-medium">{row.title}</p>
                      {row.notes ? (
                        <p className="max-w-[220px] truncate text-xs text-muted">
                          {row.notes}
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone="gold">
                        {EXPENSE_CATEGORY_LABELS[row.category]}
                      </Badge>
                    </Td>
                    <Td className="font-semibold tabular-nums">
                      {formatRs(row.amount, t.common.rs)}
                    </Td>
                    <Td className="text-muted">
                      {EXPENSE_PAYMENT_LABELS[row.paymentMethod]}
                    </Td>
                    <Td className="text-muted">{row.vendor || "—"}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(row)}
                          title={t.common.edit}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDeleteId(row.id)}
                          title={t.common.delete}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "revenue" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={a.roomRevenue} />
              <p className="text-3xl font-bold tracking-tight">
                {formatRs(snapshot.roomRevenue, t.common.rs)}
              </p>
              <p className="mt-2 text-sm text-muted">
                {a.roomRevenueHint.replace(
                  "{n}",
                  String(snapshot.checkoutCount),
                )}
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex justify-between rounded-xl border border-app bg-app px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{a.collectedOnCheckout}</p>
                    <p className="text-xs text-muted">{a.stayCollectedHint}</p>
                  </div>
                  <span className="font-semibold tabular-nums text-emerald-700">
                    {formatRs(snapshot.stayCollected, t.common.rs)}
                  </span>
                </li>
                <li className="flex justify-between rounded-xl border border-app bg-app px-4 py-3 text-sm">
                  <span className="text-muted">{a.toBePaid}</span>
                  <span className="font-semibold tabular-nums text-red-700">
                    {formatRs(snapshot.toBePaid, t.common.rs)}
                  </span>
                </li>
                <li className="flex justify-between rounded-xl border border-app bg-app px-4 py-3 text-sm">
                  <div>
                    <p className="text-muted">{a.partials}</p>
                    <p className="text-xs text-muted">
                      {snapshot.partialStayCount} stay
                      {snapshot.partialStayCount === 1 ? "" : "s"} · paid{" "}
                      {formatRs(snapshot.partialPaid, t.common.rs)}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-amber-700">
                    {formatRs(snapshot.partialDue, t.common.rs)}
                  </span>
                </li>
              </ul>
            </Card>
            <Card>
              <CardHeader title={a.foodRevenue} />
              <p className="text-3xl font-bold tracking-tight">
                {formatRs(snapshot.foodRevenue, t.common.rs)}
              </p>
              <p className="mt-2 text-sm text-muted">
                {a.foodRevenueHint.replace("{n}", String(snapshot.orderCount))}
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex justify-between rounded-xl border border-app bg-app px-4 py-3 text-sm">
                  <span className="text-muted">{t.common.paid}</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">
                    {formatRs(snapshot.foodPaid, t.common.rs)}
                  </span>
                </li>
                <li className="flex justify-between rounded-xl border border-app bg-app px-4 py-3 text-sm">
                  <span className="text-muted">{t.common.unpaid}</span>
                  <span className="font-semibold text-red-700 tabular-nums">
                    {formatRs(snapshot.foodDue, t.common.rs)}
                  </span>
                </li>
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader title={a.checkoutDetailTitle} />
            <p className="mb-4 text-sm text-muted">{a.checkoutDetailSub}</p>
            {periodCheckouts.length === 0 ? (
              <EmptyState message={a.noCheckouts} />
            ) : (
              <Table
                headers={[
                  t.common.guest,
                  t.common.room,
                  t.common.checkOut,
                  a.roomChargesCol,
                  a.colExtras,
                  a.colTotalBill,
                  a.colPaid,
                  a.colBalance,
                  a.colPlan,
                  t.status,
                  a.colWhy,
                ]}
                colWidths={[
                  "12%",
                  "7%",
                  "9%",
                  "9%",
                  "8%",
                  "9%",
                  "8%",
                  "8%",
                  "10%",
                  "8%",
                  "12%",
                ]}
              >
                {periodCheckouts.map((row) => {
                  const flags = checkoutGapFlags(row);
                  return (
                    <Tr key={row.id}>
                      <Td>
                        <p className="font-semibold">{row.guestName}</p>
                        <p className="text-xs text-muted">{row.phone || "—"}</p>
                      </Td>
                      <Td className="font-medium">{row.roomNumber}</Td>
                      <Td className="text-muted">
                        {formatDate(
                          (row.checkedOutAt
                            ? String(row.checkedOutAt).slice(0, 10)
                            : row.checkOutAt.slice(0, 10)) || "",
                        )}
                      </Td>
                      <Td className="tabular-nums font-medium">
                        {formatRs(row.roomCharges || 0, t.common.rs)}
                      </Td>
                      <Td className="tabular-nums text-muted">
                        {formatRs(row.extraCharges || 0, t.common.rs)}
                      </Td>
                      <Td className="tabular-nums font-semibold">
                        {formatRs(row.totalBill || 0, t.common.rs)}
                      </Td>
                      <Td className="tabular-nums text-emerald-700">
                        {formatRs(row.amountPaid || 0, t.common.rs)}
                      </Td>
                      <Td
                        className={cn(
                          "tabular-nums font-semibold",
                          (row.balanceDue || 0) > 0 ? "text-red-700" : "text-muted",
                        )}
                      >
                        {formatRs(row.balanceDue || 0, t.common.rs)}
                      </Td>
                      <Td className="text-xs text-muted">
                        {paymentPlanLabel(row.paymentTiming)}
                      </Td>
                      <Td>
                        <Badge tone={paymentStatusTone(row.paymentStatus)}>
                          {paymentStatusLabel(row.paymentStatus)}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {flags.map((f) => (
                            <Badge key={f} tone={gapTone(f)}>
                              {gapLabel(f)}
                            </Badge>
                          ))}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title={a.openBalancesTitle} />
            <p className="mb-4 text-sm text-muted">{a.openBalancesSub}</p>
            {openBalanceStays.length === 0 ? (
              <EmptyState message={a.noOpenBalances} />
            ) : (
              <Table
                headers={[
                  t.common.guest,
                  t.common.room,
                  t.common.checkIn,
                  a.colTotalBill,
                  a.colPaid,
                  a.colBalance,
                  a.colPlan,
                  t.status,
                ]}
                colWidths={["16%", "8%", "12%", "12%", "12%", "12%", "16%", "12%"]}
              >
                {openBalanceStays.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <p className="font-semibold">{row.guestName}</p>
                      <p className="text-xs text-muted">{row.phone || "—"}</p>
                    </Td>
                    <Td className="font-medium">{row.roomNumber}</Td>
                    <Td className="text-muted">
                      {formatDate(row.checkInAt.slice(0, 10))}
                    </Td>
                    <Td className="tabular-nums">
                      {formatRs(row.totalBill || 0, t.common.rs)}
                    </Td>
                    <Td className="tabular-nums text-emerald-700">
                      {formatRs(row.amountPaid || 0, t.common.rs)}
                    </Td>
                    <Td className="tabular-nums font-semibold text-red-700">
                      {formatRs(row.balanceDue || 0, t.common.rs)}
                    </Td>
                    <Td className="text-xs text-muted">
                      {paymentPlanLabel(row.paymentTiming)}
                    </Td>
                    <Td>
                      <Badge tone={paymentStatusTone(row.paymentStatus)}>
                        {paymentStatusLabel(row.paymentStatus)}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      ) : null}

      <Modal
        open={mode != null}
        title={mode === "edit" ? a.editExpense : a.addExpense}
        subtitle={a.expenseFormSub}
        onClose={() => !saving && setMode(null)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setMode(null)}
              disabled={saving}
            >
              {t.common.cancel}
            </Button>
            <Button variant="gold" onClick={() => void onSave()} disabled={saving}>
              {saving ? t.pages.creating : t.common.save}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={a.title} className="sm:col-span-2">
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={a.titlePlaceholder}
            />
          </Field>
          <Field label={t.common.type}>
            <FancySelect
              value={form.category}
              onChange={(v) =>
                setForm((f) => ({ ...f, category: v as ExpenseCategory }))
              }
              options={EXPENSE_CATEGORIES.map((c) => ({
                value: c,
                label: EXPENSE_CATEGORY_LABELS[c],
              }))}
            />
          </Field>
          <Field label={t.common.amount}>
            <Input
              type="number"
              min={0}
              step="1"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0"
            />
          </Field>
          <Field label={t.common.date}>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </Field>
          <Field label={a.payment}>
            <FancySelect
              value={form.paymentMethod}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  paymentMethod: v as ExpensePaymentMethod,
                }))
              }
              options={EXPENSE_PAYMENT_METHODS.map((m) => ({
                value: m,
                label: EXPENSE_PAYMENT_LABELS[m],
              }))}
            />
          </Field>
          <Field label={a.vendor}>
            <Input
              value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              placeholder={a.vendorPlaceholder}
            />
          </Field>
          <Field label={a.recordedBy}>
            <Input
              value={form.recordedBy}
              onChange={(e) =>
                setForm((f) => ({ ...f, recordedBy: e.target.value }))
              }
            />
          </Field>
          <Field label={t.common.notes} className="sm:col-span-2">
            <TextArea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </Field>
        </div>
        {formError ? (
          <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>
        ) : null}
      </Modal>

      <Modal
        open={deleteId != null}
        title={a.deleteExpense}
        subtitle={a.deleteExpenseSub}
        onClose={() => !deleting && setDeleteId(null)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => void onConfirmDelete()}
              disabled={deleting}
            >
              {deleting ? t.pages.creating : t.common.delete}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{a.deleteExpenseConfirm}</p>
      </Modal>
    </div>
  );
}
