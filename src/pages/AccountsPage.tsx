import {
  BarChart3,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FancySelect } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { EmptyState, Field, Input, PageHeader, TextArea } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import {
  buildAccountsSnapshot,
  checkoutPaymentSummary,
  dateStringInRange,
  listCheckoutsInPeriod,
  listOpenBalanceStays,
  rangeForPeriod,
  todayIsoDate,
  type AccountsPeriod,
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
  EXPENSE_KIND_LABELS,
  EXPENSE_PAYMENT_LABELS,
  EXPENSE_PAYMENT_METHODS,
  type ExpenseCategory,
  type ExpenseKind,
  type ExpensePaymentMethod,
} from "../types/expense";

type TabId = "overview" | "expenses" | "revenue";

type MeterTone = "green" | "coral" | "blue" | "gold" | "slate";

const METER_TONES: Record<MeterTone, { bar: string; dot: string }> = {
  green: { bar: "bg-emerald-500", dot: "bg-emerald-500" },
  coral: { bar: "bg-rose-400", dot: "bg-rose-400" },
  blue: { bar: "bg-sky-500", dot: "bg-sky-500" },
  gold: { bar: "bg-[var(--accent)]", dot: "bg-[var(--accent)]" },
  slate: { bar: "bg-zinc-300 dark:bg-zinc-600", dot: "bg-zinc-400" },
};

const emptyForm = () => ({
  title: "",
  kind: "operating" as ExpenseKind,
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

function meterWidth(value: number, max: number) {
  if (value <= 0 || max <= 0) return 8;
  return Math.max(10, Math.min(100, Math.round((value / max) * 100)));
}

function AccountMeterRow({
  label,
  value,
  max,
  tone,
  rs,
}: {
  label: string;
  value: number;
  max: number;
  tone: MeterTone;
  rs: string;
}) {
  const colors = METER_TONES[tone];
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", colors.dot)} />
      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-sm text-muted">{label}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-sm bg-[color-mix(in_oklab,var(--border)_70%,transparent)]">
          <div
            className={cn(
              "h-full rounded-sm transition-[width] duration-500 ease-out",
              colors.bar,
            )}
            style={{ width: `${meterWidth(value, max)}%` }}
          />
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {formatRs(value, rs)}
      </span>
    </div>
  );
}

function AccountMeterSection({
  title,
  rows,
  totalLabel,
  totalValue,
  rs,
}: {
  title: string;
  rows: { label: string; value: number; tone: MeterTone }[];
  totalLabel: string;
  totalValue: number;
  rs: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), totalValue, 1);
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold tracking-tight">{title}</h3>
      <div className="divide-y divide-[color-mix(in_oklab,var(--border)_80%,transparent)]">
        {rows.map((row) => (
          <AccountMeterRow
            key={row.label}
            label={row.label}
            value={row.value}
            max={max}
            tone={row.tone}
            rs={rs}
          />
        ))}
        <div className="flex items-center justify-between gap-3 pt-3">
          <span className="text-sm font-medium text-muted">{totalLabel}</span>
          <span className="h-px flex-1 bg-[color-mix(in_oklab,var(--border)_90%,transparent)]" />
          <span className="text-sm font-bold tabular-nums">
            {formatRs(totalValue, rs)}
          </span>
        </div>
      </div>
    </section>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "danger" | "info";
}) {
  return (
    <div className="rounded-2xl border border-app bg-app px-4 py-5 text-center">
      <p
        className={cn(
          "text-3xl font-extrabold tracking-tight tabular-nums",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
          tone === "danger" && "text-rose-600 dark:text-rose-400",
          tone === "info" && "text-sky-600 dark:text-sky-400",
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

type InsightSegment = {
  value: number;
  label: string;
  color: string;
};

function InsightPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border border-app bg-app px-2 py-0.5 text-[11px] font-medium text-muted">
      {children}
    </span>
  );
}

function formatInsightAmount(value: number) {
  const n = Math.round(Number(value) || 0);
  return n.toLocaleString();
}

function InsightMetricCard({
  title,
  value,
  accent,
  badge,
  segments,
  hint,
}: {
  title: string;
  value: string;
  accent: string;
  badge?: string;
  segments: InsightSegment[];
  hint?: string;
}) {
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const barTotal = total > 0 ? total : 1;

  return (
    <div className="surface rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            {title}
          </p>
          <span title={hint || title} className="inline-flex">
            <Info className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          </span>
        </div>
        <MoreHorizontal className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <span className={cn("h-8 w-0.5 shrink-0 rounded-full", accent)} />
        <p className="min-w-0 break-words text-2xl font-extrabold tracking-tight tabular-nums sm:text-[1.7rem]">
          {value}
        </p>
        {badge ? <InsightPill>{badge}</InsightPill> : null}
      </div>

      <div className="mt-3.5 flex h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--border)_55%,transparent)]">
        {total <= 0 ? (
          <div className={cn("h-full w-full opacity-35", accent)} />
        ) : (
          segments.map((seg) => {
            const width = (Math.max(0, seg.value) / barTotal) * 100;
            if (width <= 0) return null;
            return (
              <div
                key={`${seg.label}-${seg.color}`}
                className={cn("h-full min-w-[2px]", seg.color)}
                style={{ width: `${width}%` }}
                title={`${seg.label}: ${formatInsightAmount(seg.value)}`}
              />
            );
          })
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {segments.map((seg) => (
          <li key={`${seg.label}-row`} className="flex flex-wrap items-center gap-2.5">
            <span className={cn("h-4 w-0.5 shrink-0 rounded-full", seg.color)} />
            <span className="text-sm font-semibold tabular-nums">
              {formatInsightAmount(seg.value)}
            </span>
            <InsightPill>{seg.label}</InsightPill>
          </li>
        ))}
      </ul>
    </div>
  );
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
  const [kindFilter, setKindFilter] = useState<"all" | ExpenseKind>("all");
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
    return periodExpenses.filter((e) => {
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      return true;
    });
  }, [periodExpenses, categoryFilter, kindFilter]);

  const expenseTabStats = useMemo(() => {
    const total = filteredExpenses.reduce(
      (s, e) => s + Math.max(0, e.amount || 0),
      0,
    );
    const operatingRows = filteredExpenses.filter((e) => e.kind !== "ga");
    const gaRows = filteredExpenses.filter((e) => e.kind === "ga");
    const operatingTotal = operatingRows.reduce(
      (s, e) => s + Math.max(0, e.amount || 0),
      0,
    );
    const gaTotal = gaRows.reduce(
      (s, e) => s + Math.max(0, e.amount || 0),
      0,
    );

    const byPayment = EXPENSE_PAYMENT_METHODS.map((method) => {
      const rows = filteredExpenses.filter((e) => e.paymentMethod === method);
      return {
        method,
        amount: rows.reduce((s, e) => s + Math.max(0, e.amount || 0), 0),
        count: rows.length,
      };
    }).filter((r) => r.amount > 0 || r.count > 0);

    const byCategoryMap = new Map<ExpenseCategory, { amount: number; count: number }>();
    for (const e of filteredExpenses) {
      const row = byCategoryMap.get(e.category) ?? { amount: 0, count: 0 };
      row.amount += Math.max(0, e.amount || 0);
      row.count += 1;
      byCategoryMap.set(e.category, row);
    }
    const byCategory = [...byCategoryMap.entries()]
      .map(([category, row]) => ({ category, ...row }))
      .sort((x, y) => y.amount - x.amount);

    const cash = filteredExpenses
      .filter((e) => e.paymentMethod === "cash")
      .reduce((s, e) => s + Math.max(0, e.amount || 0), 0);
    const bank = total - cash;

    return {
      total,
      operatingTotal,
      gaTotal,
      operatingCount: operatingRows.length,
      gaCount: gaRows.length,
      byPayment,
      byCategory,
      cash,
      bank,
    };
  }, [filteredExpenses]);

  const maxCategory = snapshot.byCategory[0]?.amount || 0;
  const maxGaCategory = snapshot.byGaCategory[0]?.amount || 0;
  const maxFilteredCategory = expenseTabStats.byCategory[0]?.amount || 0;

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

  function openCreate(kind: ExpenseKind = "operating") {
    setForm({ ...emptyForm(), kind, recordedBy: staffName });
    setFormError(null);
    setEditingId(null);
    setMode("create");
  }

  function openEdit(row: ExpenseRecord) {
    setForm({
      title: row.title,
      kind: row.kind || "operating",
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
        kind: form.kind,
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
          header: "Ledger",
          value: (r) => EXPENSE_KIND_LABELS[r.kind] || r.kind,
        },
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
              className="w-full sm:w-auto"
              onClick={() => void onRefresh()}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {a.refresh}
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto" onClick={onExportExpenses}>
              {t.common.export}
            </Button>
            <Button variant="gold" className="w-full sm:w-auto" onClick={() => openCreate("operating")}>
              <Plus className="h-4 w-4" />
              {a.addExpense}
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => openCreate("ga")}>
              <Plus className="h-4 w-4" />
              {a.addGaExpense}
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
        <InsightMetricCard
          title={a.revenue}
          value={formatRs(snapshot.revenue, t.common.rs)}
          accent="bg-emerald-500"
          badge={a.statusTotal}
          hint={`${a.room}: ${formatRs(snapshot.roomRevenue, t.common.rs)} · ${a.food}: ${formatRs(snapshot.foodRevenue, t.common.rs)}`}
          segments={[
            {
              value: snapshot.roomRevenue,
              label: a.room,
              color: "bg-emerald-500",
            },
            {
              value: snapshot.foodRevenue,
              label: a.food,
              color: "bg-sky-500",
            },
          ]}
        />
        <InsightMetricCard
          title={a.expenditures}
          value={formatRs(
            snapshot.expenditures + snapshot.gaExpenditures,
            t.common.rs,
          )}
          accent="bg-[var(--accent)]"
          badge={`${snapshot.expenseCount + snapshot.gaCount} ${a.entries}`}
          hint={`${snapshot.expenseCount + snapshot.gaCount} ${a.entries}`}
          segments={[
            {
              value: snapshot.expenditures,
              label: a.kindOperating,
              color: "bg-[var(--accent)]",
            },
            {
              value: snapshot.gaExpenditures,
              label: a.kindGa,
              color: "bg-amber-300 dark:bg-amber-500/70",
            },
          ]}
        />
        <InsightMetricCard
          title={a.profit}
          value={formatRs(snapshot.profit, t.common.rs)}
          accent={profitPositive ? "bg-emerald-500" : "bg-rose-500"}
          badge={profitPositive ? a.statusProfit : a.statusLoss}
          hint={profitPositive ? a.profitHint : a.lossHint}
          segments={[
            {
              value: Math.max(0, snapshot.revenue),
              label: a.revenue,
              color: "bg-emerald-500",
            },
            {
              value: snapshot.expenditures + snapshot.gaExpenditures,
              label: a.expenditures,
              color: profitPositive
                ? "bg-emerald-200 dark:bg-emerald-800"
                : "bg-rose-400",
            },
          ]}
        />
        <InsightMetricCard
          title={a.outstanding}
          value={formatRs(snapshot.toBePaid, t.common.rs)}
          accent="bg-rose-500"
          badge={a.statusDue}
          hint={`${a.collected}: ${formatRs(snapshot.collected, t.common.rs)}`}
          segments={[
            {
              value: snapshot.toBePaid,
              label: a.toBePaid,
              color: "bg-rose-500",
            },
            {
              value: snapshot.collected,
              label: a.collected,
              color: "bg-zinc-300 dark:bg-zinc-600",
            },
            ...(snapshot.partialPaid > 0
              ? [
                  {
                    value: snapshot.partialPaid,
                    label: a.partials,
                    color: "bg-[var(--accent)]",
                  },
                ]
              : []),
          ]}
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
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader title={a.revenueBreakdown} />
              <div className="grid grid-cols-2 gap-3">
                <SummaryTile
                  label={a.room}
                  value={formatRs(snapshot.roomRevenue, t.common.rs)}
                  hint={`${snapshot.checkoutCount} ${a.checkouts}`}
                  tone="success"
                />
                <SummaryTile
                  label={a.food}
                  value={formatRs(snapshot.foodRevenue, t.common.rs)}
                  hint={`${snapshot.orderCount} ${a.orders}`}
                  tone="info"
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-app bg-elevated px-3 py-3 text-center">
                  <p className="text-lg font-extrabold tabular-nums text-emerald-600">
                    {formatRs(snapshot.collected, t.common.rs)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {a.collected}
                  </p>
                </div>
                <div className="rounded-xl border border-app bg-elevated px-3 py-3 text-center">
                  <p className="text-lg font-extrabold tabular-nums text-rose-600">
                    {formatRs(snapshot.toBePaid, t.common.rs)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {a.outstanding}
                  </p>
                </div>
                <div className="rounded-xl border border-app bg-elevated px-3 py-3 text-center">
                  <p
                    className={cn(
                      "text-lg font-extrabold tabular-nums",
                      profitPositive ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    {formatRs(snapshot.profit, t.common.rs)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {a.profit}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title={a.accountPanel}
                action={
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-app">
                    <BarChart3 className="h-4 w-4 text-sky-500" />
                  </div>
                }
              />
              <p className="mb-5 text-sm text-muted">{a.accountPanelSub}</p>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                  <AccountMeterSection
                    title={a.cashBankBalance}
                    rs={t.common.rs}
                    totalLabel={t.common.total}
                    totalValue={snapshot.cashBalance + snapshot.bankBalance}
                    rows={[
                      {
                        label: a.cashInHand,
                        value: snapshot.cashBalance,
                        tone: "green",
                      },
                      {
                        label: a.bankCardOnline,
                        value: snapshot.bankBalance,
                        tone: "coral",
                      },
                    ]}
                  />
                  <AccountMeterSection
                    title={a.receivables}
                    rs={t.common.rs}
                    totalLabel={t.common.total}
                    totalValue={snapshot.toBePaid + snapshot.partialPaid}
                    rows={[
                      {
                        label: a.toBePaid,
                        value: snapshot.toBePaid,
                        tone: "coral",
                      },
                      {
                        label: a.partialPaidLabel,
                        value: snapshot.partialPaid,
                        tone: "gold",
                      },
                    ]}
                  />
                </div>

                <div className="space-y-6">
                  <AccountMeterSection
                    title={a.revenuesPanel}
                    rs={t.common.rs}
                    totalLabel={t.common.total}
                    totalValue={snapshot.revenue}
                    rows={[
                      {
                        label: a.roomRevenue,
                        value: snapshot.roomRevenue,
                        tone: "green",
                      },
                      {
                        label: a.foodRevenue,
                        value: snapshot.foodRevenue,
                        tone: "blue",
                      },
                    ]}
                  />
                  <AccountMeterSection
                    title={a.outflowsPanel}
                    rs={t.common.rs}
                    totalLabel={t.common.total}
                    totalValue={snapshot.expenditures + snapshot.gaExpenditures}
                    rows={[
                      {
                        label: a.expenseCashOut,
                        value: snapshot.expenseCash,
                        tone: "coral",
                      },
                      {
                        label: a.expenseBankOut,
                        value: snapshot.expenseBank,
                        tone: "blue",
                      },
                    ]}
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-xl border border-app bg-app px-4 py-3">
                {profitPositive ? (
                  <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 shrink-0 text-red-600" />
                )}
                <p className="text-sm">
                  <span className="font-semibold">{a.netResult}: </span>
                  <span
                    className={
                      profitPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                    }
                  >
                    {formatRs(snapshot.profit, t.common.rs)}
                  </span>
                  <span className="text-muted">
                    {" "}
                    ({a.revenue} − {a.expenditures} − {a.gaExpenditures})
                  </span>
                </p>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={a.expenseByCategory} />
              {snapshot.byCategory.length === 0 ? (
                <EmptyState message={`${a.noExpenses} ${a.noExpensesSub}`} />
              ) : (
                <ul className="space-y-3">
                  {snapshot.byCategory.map((row, index) => {
                    const pct = maxCategory
                      ? Math.max(8, Math.round((row.amount / maxCategory) * 100))
                      : 0;
                    const tone: MeterTone =
                      index % 3 === 0 ? "gold" : index % 3 === 1 ? "blue" : "green";
                    return (
                      <li key={row.category}>
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2 font-medium">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                METER_TONES[tone].dot,
                              )}
                            />
                            {EXPENSE_CATEGORY_LABELS[row.category]}
                          </span>
                          <span className="tabular-nums text-muted">
                            {formatRs(row.amount, t.common.rs)} · {row.count}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-sm bg-app">
                          <div
                            className={cn(
                              "h-full rounded-sm transition-[width] duration-500",
                              METER_TONES[tone].bar,
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title={a.gaByCategory} />
              {snapshot.byGaCategory.length === 0 ? (
                <EmptyState message={a.noGaExpenses} />
              ) : (
                <ul className="space-y-3">
                  {snapshot.byGaCategory.map((row, index) => {
                    const pct = maxGaCategory
                      ? Math.max(8, Math.round((row.amount / maxGaCategory) * 100))
                      : 0;
                    const tone: MeterTone =
                      index % 3 === 0 ? "coral" : index % 3 === 1 ? "blue" : "gold";
                    return (
                      <li key={row.category}>
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2 font-medium">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                METER_TONES[tone].dot,
                              )}
                            />
                            {EXPENSE_CATEGORY_LABELS[row.category]}
                          </span>
                          <span className="tabular-nums text-muted">
                            {formatRs(row.amount, t.common.rs)} · {row.count}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-sm bg-app">
                          <div
                            className={cn(
                              "h-full rounded-sm transition-[width] duration-500",
                              METER_TONES[tone].bar,
                            )}
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
        </div>
      ) : null}

      {tab === "expenses" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader title={a.tabExpenses} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <SummaryTile
                  label={t.common.total}
                  value={formatRs(expenseTabStats.total, t.common.rs)}
                  hint={`${filteredExpenses.length} ${a.entries}`}
                  tone="danger"
                />
                <SummaryTile
                  label={a.kindOperating}
                  value={formatRs(expenseTabStats.operatingTotal, t.common.rs)}
                  hint={`${expenseTabStats.operatingCount} ${a.entries}`}
                  tone="default"
                />
                <SummaryTile
                  label={a.kindGa}
                  value={formatRs(expenseTabStats.gaTotal, t.common.rs)}
                  hint={`${expenseTabStats.gaCount} ${a.entries}`}
                  tone="info"
                />
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title={a.outflowsPanel}
                action={
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-app">
                    <BarChart3 className="h-4 w-4 text-rose-400" />
                  </div>
                }
              />
              <p className="mb-5 text-sm text-muted">{a.expensePanelSub}</p>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                  <AccountMeterSection
                    title={a.byLedger}
                    rs={t.common.rs}
                    totalLabel={t.common.total}
                    totalValue={expenseTabStats.total}
                    rows={[
                      {
                        label: a.kindOperating,
                        value: expenseTabStats.operatingTotal,
                        tone: "gold",
                      },
                      {
                        label: a.kindGa,
                        value: expenseTabStats.gaTotal,
                        tone: "blue",
                      },
                    ]}
                  />
                  <AccountMeterSection
                    title={a.cashBankBalance}
                    rs={t.common.rs}
                    totalLabel={t.common.total}
                    totalValue={expenseTabStats.total}
                    rows={[
                      {
                        label: a.expenseCashOut,
                        value: expenseTabStats.cash,
                        tone: "coral",
                      },
                      {
                        label: a.expenseBankOut,
                        value: expenseTabStats.bank,
                        tone: "blue",
                      },
                    ]}
                  />
                </div>
                <AccountMeterSection
                  title={a.byPaymentMethod}
                  rs={t.common.rs}
                  totalLabel={t.common.total}
                  totalValue={expenseTabStats.total}
                  rows={
                    expenseTabStats.byPayment.length
                      ? expenseTabStats.byPayment.map((row, index) => ({
                          label: EXPENSE_PAYMENT_LABELS[row.method],
                          value: row.amount,
                          tone: (["green", "coral", "blue", "gold"] as MeterTone[])[
                            index % 4
                          ],
                        }))
                      : [
                          {
                            label: a.cashInHand,
                            value: 0,
                            tone: "slate" as MeterTone,
                          },
                        ]
                  }
                />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title={a.expenseByCategory} />
            {expenseTabStats.byCategory.length === 0 ? (
              <EmptyState message={`${a.noExpenses} ${a.noExpensesSub}`} />
            ) : (
              <ul className="space-y-3">
                {expenseTabStats.byCategory.map((row, index) => {
                  const pct = maxFilteredCategory
                    ? Math.max(8, Math.round((row.amount / maxFilteredCategory) * 100))
                    : 0;
                  const tone: MeterTone =
                    index % 4 === 0
                      ? "coral"
                      : index % 4 === 1
                        ? "blue"
                        : index % 4 === 2
                          ? "gold"
                          : "green";
                  return (
                    <li key={row.category}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className={cn("h-2 w-2 rounded-full", METER_TONES[tone].dot)}
                          />
                          {EXPENSE_CATEGORY_LABELS[row.category]}
                        </span>
                        <span className="tabular-nums text-muted">
                          {formatRs(row.amount, t.common.rs)} · {row.count}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-sm bg-app">
                        <div
                          className={cn(
                            "h-full rounded-sm transition-[width] duration-500",
                            METER_TONES[tone].bar,
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={kindFilter === "all" ? "gold" : "secondary"}
              onClick={() => setKindFilter("all")}
            >
              {t.common.all}
            </Button>
            <Button
              size="sm"
              variant={kindFilter === "operating" ? "gold" : "secondary"}
              onClick={() => setKindFilter("operating")}
            >
              {a.kindOperating}
            </Button>
            <Button
              size="sm"
              variant={kindFilter === "ga" ? "gold" : "secondary"}
              onClick={() => setKindFilter("ga")}
            >
              {a.kindGa}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <CardHeader
              title={a.expenseListTitle}
              badge={
                <Badge tone="muted">
                  {filteredExpenses.length} {a.entries}
                </Badge>
              }
            />
            {filteredExpenses.length === 0 ? (
              <EmptyState message={`${a.noExpenses} ${a.noExpensesSub}`} />
            ) : (
              <ul className="space-y-3">
                {filteredExpenses.map((row) => {
                  const pct = expenseTabStats.total
                    ? Math.max(
                        8,
                        Math.round(
                          (Math.max(0, row.amount || 0) / expenseTabStats.total) * 100,
                        ),
                      )
                    : 8;
                  const tone: MeterTone =
                    row.paymentMethod === "cash"
                      ? "coral"
                      : row.paymentMethod === "card"
                        ? "blue"
                        : row.paymentMethod === "bank_transfer"
                          ? "green"
                          : "gold";
                  return (
                    <li
                      key={row.id}
                      className="rounded-2xl border border-app bg-app px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{row.title}</p>
                            <Badge tone={row.kind === "ga" ? "info" : "gold"}>
                              {row.kind === "ga" ? a.kindGa : a.kindOperating}
                            </Badge>
                            <Badge tone="muted">
                              {EXPENSE_CATEGORY_LABELS[row.category]}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            {formatDate(row.date)}
                            {" · "}
                            {EXPENSE_PAYMENT_LABELS[row.paymentMethod]}
                            {row.vendor ? ` · ${row.vendor}` : ""}
                          </p>
                          {row.notes ? (
                            <p className="mt-1 max-w-xl truncate text-xs text-muted">
                              {row.notes}
                            </p>
                          ) : null}
                          <div className="mt-3 h-2 overflow-hidden rounded-sm bg-elevated">
                            <div
                              className={cn(
                                "h-full rounded-sm transition-[width] duration-500",
                                METER_TONES[tone].bar,
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <p className="text-base font-extrabold tabular-nums">
                            {formatRs(row.amount, t.common.rs)}
                          </p>
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
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "revenue" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader title={a.tabRevenue} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <SummaryTile
                  label={a.revenue}
                  value={formatRs(snapshot.revenue, t.common.rs)}
                  hint={`${snapshot.checkoutCount} ${a.checkouts} · ${snapshot.orderCount} ${a.orders}`}
                  tone="success"
                />
                <SummaryTile
                  label={a.roomRevenue}
                  value={formatRs(snapshot.roomRevenue, t.common.rs)}
                  hint={a.roomRevenueHint.replace(
                    "{n}",
                    String(snapshot.checkoutCount),
                  )}
                  tone="default"
                />
                <SummaryTile
                  label={a.foodRevenue}
                  value={formatRs(snapshot.foodRevenue, t.common.rs)}
                  hint={a.foodRevenueHint.replace(
                    "{n}",
                    String(snapshot.orderCount),
                  )}
                  tone="info"
                />
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title={a.revenuesPanel}
                action={
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-app">
                    <BarChart3 className="h-4 w-4 text-sky-500" />
                  </div>
                }
              />
              <p className="mb-5 text-sm text-muted">{a.revenuePanelSub}</p>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                  <AccountMeterSection
                    title={a.revenuesPanel}
                    rs={t.common.rs}
                    totalLabel={t.common.total}
                    totalValue={snapshot.revenue}
                    rows={[
                      {
                        label: a.roomRevenue,
                        value: snapshot.roomRevenue,
                        tone: "green",
                      },
                      {
                        label: a.foodRevenue,
                        value: snapshot.foodRevenue,
                        tone: "blue",
                      },
                    ]}
                  />
                  <AccountMeterSection
                    title={a.foodRevenue}
                    rs={t.common.rs}
                    totalLabel={t.common.total}
                    totalValue={snapshot.foodRevenue}
                    rows={[
                      {
                        label: a.foodPaid,
                        value: snapshot.foodPaid,
                        tone: "green",
                      },
                      {
                        label: a.foodDue,
                        value: snapshot.foodDue,
                        tone: "coral",
                      },
                    ]}
                  />
                </div>
                <div className="space-y-6">
                  <AccountMeterSection
                    title={a.cashBankBalance}
                    rs={t.common.rs}
                    totalLabel={t.common.total}
                    totalValue={snapshot.cashBalance + snapshot.bankBalance}
                    rows={[
                      {
                        label: a.cashInHand,
                        value: snapshot.cashBalance,
                        tone: "green",
                      },
                      {
                        label: a.bankCardOnline,
                        value: snapshot.bankBalance,
                        tone: "coral",
                      },
                    ]}
                  />
                  <AccountMeterSection
                    title={a.settlementTitle}
                    rs={t.common.rs}
                    totalLabel={t.common.total}
                    totalValue={
                      snapshot.collected + snapshot.toBePaid + snapshot.partialPaid
                    }
                    rows={[
                      {
                        label: a.collectedOnCheckout,
                        value: snapshot.collected,
                        tone: "green",
                      },
                      {
                        label: a.toBePaid,
                        value: snapshot.toBePaid,
                        tone: "coral",
                      },
                      {
                        label: a.partialPaidLabel,
                        value: snapshot.partialPaid,
                        tone: "gold",
                      },
                    ]}
                  />
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={a.checkoutDetailTitle}
              badge={
                <Badge tone="muted">
                  {periodCheckouts.length} {a.checkouts}
                </Badge>
              }
            />
            <p className="mb-4 text-sm text-muted">{a.checkoutDetailSub}</p>
            {periodCheckouts.length === 0 ? (
              <EmptyState message={a.noCheckouts} />
            ) : (
              <div className="space-y-3">
                {periodCheckouts.map((row) => {
                  const summary = checkoutPaymentSummary(row, t.common.rs);
                  const checkoutDate = formatDate(
                    (row.checkedOutAt
                      ? String(row.checkedOutAt).slice(0, 10)
                      : row.checkOutAt.slice(0, 10)) || "",
                  );
                  const total = Math.max(
                    0,
                    Number(row.totalBill) ||
                      Number(row.roomCharges) + Number(row.extraCharges) ||
                      0,
                  );
                  const paid = Math.max(0, Number(row.amountPaid) || 0);
                  const due = Math.max(0, Number(row.balanceDue) || 0);
                  const paidPct = total
                    ? Math.max(6, Math.min(100, Math.round((paid / total) * 100)))
                    : paid > 0
                      ? 100
                      : 0;
                  return (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-app bg-app px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-extrabold">{row.guestName}</p>
                          <p className="mt-0.5 text-sm text-muted">
                            {t.common.room} {row.roomNumber}
                            {row.phone ? ` · ${row.phone}` : ""}
                            {" · "}
                            {checkoutDate}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {a.colPlan}: {paymentPlanLabel(row.paymentTiming)}
                          </p>
                        </div>
                        <Badge tone={paymentStatusTone(row.paymentStatus)}>
                          {paymentStatusLabel(row.paymentStatus)}
                        </Badge>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                          <span>{a.colPaid}</span>
                          <span>
                            {formatRs(paid, t.common.rs)} / {formatRs(total, t.common.rs)}
                          </span>
                        </div>
                        <div className="flex h-2.5 overflow-hidden rounded-sm bg-elevated">
                          <div
                            className="h-full bg-emerald-500 transition-[width] duration-500"
                            style={{ width: `${paidPct}%` }}
                          />
                          {due > 0 ? (
                            <div
                              className="h-full bg-rose-400 transition-[width] duration-500"
                              style={{ width: `${Math.max(0, 100 - paidPct)}%` }}
                            />
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        <div className="rounded-xl border border-app bg-elevated px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                            {a.roomChargesCol}
                          </p>
                          <p className="mt-1 text-sm font-bold tabular-nums">
                            {formatRs(row.roomCharges || 0, t.common.rs)}
                          </p>
                          {row.discountPercent > 0 ? (
                            <p className="mt-0.5 text-[11px] font-normal text-muted">
                              {row.discountPercent}% off
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-xl border border-app bg-elevated px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                            {a.colExtras}
                          </p>
                          <p className="mt-1 text-sm font-bold tabular-nums">
                            {formatRs(row.extraCharges || 0, t.common.rs)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-app bg-elevated px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                            {a.colTotalBill}
                          </p>
                          <p className="mt-1 text-sm font-bold tabular-nums">
                            {formatRs(row.totalBill || 0, t.common.rs)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-app bg-elevated px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                            {a.colPaid}
                          </p>
                          <p className="mt-1 text-sm font-bold tabular-nums text-emerald-700">
                            {formatRs(row.amountPaid || 0, t.common.rs)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-app bg-elevated px-3 py-2.5 col-span-2 sm:col-span-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                            {a.colBalance}
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-sm font-bold tabular-nums",
                              (row.balanceDue || 0) > 0 ? "text-red-700" : "text-muted",
                            )}
                          >
                            {formatRs(row.balanceDue || 0, t.common.rs)}
                          </p>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "mt-3 rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
                          summary.tone === "success" &&
                            "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
                          summary.tone === "danger" &&
                            "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
                          summary.tone === "warning" &&
                            "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200",
                          summary.tone === "muted" && "border-app bg-elevated text-muted",
                        )}
                      >
                        <span className="font-semibold text-app">{a.colSummary}: </span>
                        {summary.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title={a.openBalancesTitle}
              badge={
                <Badge tone="danger">
                  {openBalanceStays.length} {a.partials}
                </Badge>
              }
            />
            <p className="mb-4 text-sm text-muted">{a.openBalancesSub}</p>
            {openBalanceStays.length === 0 ? (
              <EmptyState message={a.noOpenBalances} />
            ) : (
              <ul className="space-y-3">
                {openBalanceStays.map((row) => {
                  const total = Math.max(0, Number(row.totalBill) || 0);
                  const paid = Math.max(0, Number(row.amountPaid) || 0);
                  const due = Math.max(0, Number(row.balanceDue) || 0);
                  const paidPct = total
                    ? Math.max(6, Math.min(100, Math.round((paid / total) * 100)))
                    : 0;
                  return (
                    <li
                      key={row.id}
                      className="rounded-2xl border border-app bg-app px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-extrabold">{row.guestName}</p>
                          <p className="mt-0.5 text-sm text-muted">
                            {t.common.room} {row.roomNumber}
                            {row.phone ? ` · ${row.phone}` : ""}
                            {" · "}
                            {formatDate(row.checkInAt.slice(0, 10))}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {a.colPlan}: {paymentPlanLabel(row.paymentTiming)}
                          </p>
                        </div>
                        <Badge tone={paymentStatusTone(row.paymentStatus)}>
                          {paymentStatusLabel(row.paymentStatus)}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                        <div className="min-w-0">
                          <div className="mb-1 flex justify-between gap-2 text-xs text-muted">
                            <span>
                              {a.colPaid} {formatRs(paid, t.common.rs)}
                            </span>
                            <span>
                              {a.colBalance} {formatRs(due, t.common.rs)}
                            </span>
                          </div>
                          <div className="flex h-2.5 overflow-hidden rounded-sm bg-elevated">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${paidPct}%` }}
                            />
                            <div
                              className="h-full bg-rose-400"
                              style={{ width: `${Math.max(0, 100 - paidPct)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-bold tabular-nums">
                          {formatRs(total, t.common.rs)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      <Modal
        open={mode != null}
        title={
          mode === "edit"
            ? form.kind === "ga"
              ? a.editGaExpense
              : a.editExpense
            : form.kind === "ga"
              ? a.addGaExpense
              : a.addExpense
        }
        subtitle={form.kind === "ga" ? a.gaFormSub : a.expenseFormSub}
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
