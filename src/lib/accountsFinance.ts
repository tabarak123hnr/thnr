import type { CheckInRecord } from "../types/checkIn";
import type { ExpenseCategory, ExpenseRecord } from "../types/expense";
import { EXPENSE_CATEGORIES } from "../types/expense";
import type { FoodOrder } from "../types/order";

export type AccountsPeriod = "today" | "week" | "month" | "all";

export type DateRange = { startMs: number; endMs: number } | null;

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function tsMs(value: unknown): number {
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

/** Inclusive local calendar range for a named period. `all` → null (no filter). */
export function rangeForPeriod(period: AccountsPeriod, now = new Date()): DateRange {
  const end = startOfLocalDay(now) + 24 * 60 * 60 * 1000 - 1;
  if (period === "all") return null;
  if (period === "today") {
    return { startMs: startOfLocalDay(now), endMs: end };
  }
  if (period === "week") {
    const day = now.getDay(); // 0 Sun
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    return { startMs: startOfLocalDay(monday), endMs: end };
  }
  // month
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startMs: startOfLocalDay(first), endMs: end };
}

export function inRange(ms: number, range: DateRange) {
  if (!range) return true;
  if (!ms) return false;
  return ms >= range.startMs && ms <= range.endMs;
}

/** YYYY-MM-DD within range (expense.date). */
export function dateStringInRange(isoDate: string, range: DateRange) {
  if (!range) return true;
  const ms = Date.parse(`${isoDate.slice(0, 10)}T12:00:00`);
  return inRange(ms, range);
}

export type CategoryBreakdown = { category: ExpenseCategory; amount: number; count: number };

export type AccountsSnapshot = {
  roomRevenue: number;
  foodRevenue: number;
  foodPaid: number;
  foodDue: number;
  /** Room + food billed in period */
  revenue: number;
  /**
   * Cash collected without double-counting food:
   * checkout amountPaid (room + extras) + paid food still on in-house stays.
   */
  collected: number;
  /** Cash collected on period checkouts (full stay settlement) */
  stayCollected: number;
  /** Open stay balances + unpaid food on in-house / unsettled stays */
  toBePaid: number;
  /** Amount already paid on in-house partial stays */
  partialPaid: number;
  /** Remaining balance on in-house partial stays */
  partialDue: number;
  partialStayCount: number;
  /** @deprecated alias of toBePaid */
  outstanding: number;
  expenditures: number;
  profit: number;
  checkoutCount: number;
  orderCount: number;
  expenseCount: number;
  byCategory: CategoryBreakdown[];
};

export function buildAccountsSnapshot(
  checkIns: CheckInRecord[],
  orders: FoodOrder[],
  expenses: ExpenseRecord[],
  range: DateRange,
): AccountsSnapshot {
  const checkedOutInPeriod = checkIns.filter(
    (c) =>
      c.status === "checked_out" &&
      inRange(tsMs(c.checkedOutAt) || Date.parse(c.checkOutAt) || 0, range),
  );
  const checkedOutIds = new Set(checkedOutInPeriod.map((c) => c.id));

  const roomRevenue = checkedOutInPeriod.reduce(
    (s, c) => s + Math.max(0, Number(c.roomCharges) || 0),
    0,
  );
  const stayCollected = checkedOutInPeriod.reduce(
    (s, c) => s + Math.max(0, Number(c.amountPaid) || 0),
    0,
  );

  const ordersInPeriod = orders.filter((o) => inRange(tsMs(o.createdAt), range));
  const foodRevenue = ordersInPeriod.reduce((s, o) => s + Math.max(0, o.amount || 0), 0);

  /** Stay settled in full → kitchen tickets count as paid even if legacy rows still say "due". */
  const settledStayIds = new Set(
    checkIns
      .filter(
        (c) =>
          c.status === "checked_out" &&
          (Math.max(0, Number(c.balanceDue) || 0) <= 0 || c.paymentStatus === "paid"),
      )
      .map((c) => c.id),
  );

  function orderIsPaid(o: FoodOrder) {
    return (
      o.paymentStatus === "paid" ||
      (Boolean(o.checkInId) && settledStayIds.has(o.checkInId))
    );
  }

  const foodPaid = ordersInPeriod
    .filter(orderIsPaid)
    .reduce((s, o) => s + Math.max(0, o.amount || 0), 0);
  const foodDue = foodRevenue - foodPaid;

  // Paid food already inside checkout amountPaid — don't count twice
  const foodPaidOnOpenStays = ordersInPeriod
    .filter(
      (o) =>
        orderIsPaid(o) &&
        o.checkInId &&
        !checkedOutIds.has(o.checkInId),
    )
    .reduce((s, o) => s + Math.max(0, o.amount || 0), 0);

  const expensesInPeriod = expenses.filter((e) => dateStringInRange(e.date, range));
  const expenditures = expensesInPeriod.reduce(
    (s, e) => s + Math.max(0, e.amount || 0),
    0,
  );

  const byCategoryMap = new Map<ExpenseCategory, { amount: number; count: number }>();
  for (const cat of EXPENSE_CATEGORIES) {
    byCategoryMap.set(cat, { amount: 0, count: 0 });
  }
  for (const e of expensesInPeriod) {
    const row = byCategoryMap.get(e.category) ?? { amount: 0, count: 0 };
    row.amount += e.amount;
    row.count += 1;
    byCategoryMap.set(e.category, row);
  }
  const byCategory: CategoryBreakdown[] = EXPENSE_CATEGORIES.map((category) => ({
    category,
    amount: byCategoryMap.get(category)?.amount ?? 0,
    count: byCategoryMap.get(category)?.count ?? 0,
  }))
    .filter((r) => r.amount > 0 || r.count > 0)
    .sort((a, b) => b.amount - a.amount);

  const inHouse = checkIns.filter((c) => c.status === "checked_in");
  const partialStays = inHouse.filter(
    (c) =>
      c.paymentStatus === "partial" ||
      (Math.max(0, Number(c.amountPaid) || 0) > 0 &&
        Math.max(0, Number(c.balanceDue) || 0) > 0),
  );
  const partialPaid = partialStays.reduce(
    (s, c) => s + Math.max(0, Number(c.amountPaid) || 0),
    0,
  );
  const partialDue = partialStays.reduce(
    (s, c) => s + Math.max(0, Number(c.balanceDue) || 0),
    0,
  );

  const outstandingStays = inHouse.reduce(
    (s, c) => s + Math.max(0, Number(c.balanceDue) || 0),
    0,
  );
  const inHouseIds = new Set(inHouse.map((c) => c.id));
  // Unpaid food only on open stays (settled checkouts count as paid)
  const outstandingFood = orders
    .filter(
      (o) =>
        !orderIsPaid(o) &&
        (!o.checkInId || inHouseIds.has(o.checkInId)),
    )
    .reduce((s, o) => s + Math.max(0, o.amount || 0), 0);

  const toBePaid = outstandingStays + outstandingFood;
  const revenue = roomRevenue + foodRevenue;
  const collected = stayCollected + foodPaidOnOpenStays;

  return {
    roomRevenue,
    foodRevenue,
    foodPaid,
    foodDue,
    revenue,
    collected,
    stayCollected,
    toBePaid,
    partialPaid,
    partialDue,
    partialStayCount: partialStays.length,
    outstanding: toBePaid,
    expenditures,
    profit: revenue - expenditures,
    checkoutCount: checkedOutInPeriod.length,
    orderCount: ordersInPeriod.length,
    expenseCount: expensesInPeriod.length,
    byCategory,
  };
}

/** Checkouts that drive room revenue / collected figures for the period. */
export function listCheckoutsInPeriod(
  checkIns: CheckInRecord[],
  range: DateRange,
): CheckInRecord[] {
  return checkIns
    .filter(
      (c) =>
        c.status === "checked_out" &&
        inRange(tsMs(c.checkedOutAt) || Date.parse(c.checkOutAt) || 0, range),
    )
    .sort((a, b) => {
      const ta = tsMs(a.checkedOutAt) || Date.parse(a.checkOutAt) || 0;
      const tb = tsMs(b.checkedOutAt) || Date.parse(b.checkOutAt) || 0;
      return tb - ta;
    });
}

/** In-house guests who still owe a balance (feeds Outstanding KPI). */
export function listOpenBalanceStays(checkIns: CheckInRecord[]): CheckInRecord[] {
  return checkIns
    .filter((c) => c.status === "checked_in" && Math.max(0, Number(c.balanceDue) || 0) > 0)
    .sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0));
}

export type CheckoutGapFlag =
  | "owes_balance"
  | "partial_plan"
  | "due_on_checkout"
  | "paid_covers_extras"
  | "paid_below_room"
  | "paid_above_room"
  | "fully_settled";

/** Why room charges and amount paid can differ on one stay. */
export function checkoutGapFlags(row: CheckInRecord): CheckoutGapFlag[] {
  const room = Math.max(0, Number(row.roomCharges) || 0);
  const extras = Math.max(0, Number(row.extraCharges) || 0);
  const paid = Math.max(0, Number(row.amountPaid) || 0);
  const due = Math.max(0, Number(row.balanceDue) || 0);
  const flags: CheckoutGapFlag[] = [];

  if (due > 0) flags.push("owes_balance");
  if (row.paymentTiming === "partial") flags.push("partial_plan");
  if (row.paymentTiming === "due_on_checkout") flags.push("due_on_checkout");
  if (extras > 0 && paid > 0) flags.push("paid_covers_extras");
  if (paid + 0.5 < room && due > 0) flags.push("paid_below_room");
  if (paid > room + 0.5 && extras > 0) flags.push("paid_above_room");
  if (flags.length === 0 && due <= 0) flags.push("fully_settled");

  return flags;
}

export function todayIsoDate(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
