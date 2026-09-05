import { calcRoomBill } from "./billing";
import type { CheckInRecord, PaymentStatus, PaymentTiming } from "../types/checkIn";
import type { FoodOrder } from "../types/order";
import {
  invoiceListStatus,
  type GuestInvoice,
  type InvoiceFoodLine,
} from "../types/invoice";

function stampFrom(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--------";
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function shortId(checkInId: string) {
  return checkInId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "XXXX";
}

function roomInvoiceNumber(checkInId: string, roomNumber: string, checkInAt: string) {
  return `INV-RM-${roomNumber || "RM"}-${stampFrom(checkInAt)}-${shortId(checkInId)}`;
}

function foodInvoiceNumber(checkInId: string, roomNumber: string, checkInAt: string) {
  return `INV-FD-${roomNumber || "RM"}-${stampFrom(checkInAt)}-${shortId(checkInId)}`;
}

function resolveBill(row: CheckInRecord) {
  if (row.totalBill > 0 && row.nightlyRate >= 0) {
    return {
      nights: row.nights || 1,
      nightlyRate: row.nightlyRate,
      roomCharges: row.roomCharges || row.nightlyRate * (row.nights || 1),
      extraCharges: row.extraCharges || 0,
      totalBill: row.totalBill,
    };
  }
  return calcRoomBill(
    row.nightlyRate,
    row.checkInAt,
    row.checkOutAt,
    row.extraCharges || 0,
  );
}

function paymentFromSplit(
  total: number,
  paid: number,
): { amountPaid: number; balanceDue: number; paymentStatus: PaymentStatus } {
  const amountPaid = Math.max(0, Math.min(total, paid));
  const balanceDue = Math.max(0, Math.round((total - amountPaid) * 100) / 100);
  const paymentStatus: PaymentStatus =
    balanceDue <= 0 ? "paid" : amountPaid > 0 ? "partial" : "due";
  return { amountPaid, balanceDue, paymentStatus };
}

/** Checkout completed with remaining balance collected → stay is fully settled. */
export function isStaySettled(row: CheckInRecord) {
  if (row.status !== "checked_out") return false;
  return (
    Math.max(0, Number(row.balanceDue) || 0) <= 0 || row.paymentStatus === "paid"
  );
}

function stayOrdersFor(row: CheckInRecord, orders: FoodOrder[]) {
  return orders.filter((o) => o.checkInId === row.id);
}

function guestBase(row: CheckInRecord) {
  return {
    checkInId: row.id,
    issuedAt: new Date().toISOString(),
    guestName: row.guestName,
    phone: row.phone,
    email: row.email || "",
    cnic: row.cnic || "",
    nationality: row.nationality || "",
    roomNumber: row.roomNumber,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkedOutAt || row.checkOutAt,
    stayStatus: row.status,
    notes: row.notes || "",
    adults: row.adults,
    children: row.children,
    paymentTiming: row.paymentTiming,
  };
}

function buildFoodLines(orders: FoodOrder[], forcePaid: boolean): InvoiceFoodLine[] {
  const lines: InvoiceFoodLine[] = [];
  for (const order of orders) {
    const linePaid = forcePaid || order.paymentStatus === "paid";
    for (const item of order.items) {
      lines.push({
        orderToken: order.token,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        amount: item.lineTotal || item.qty * item.unitPrice,
        status: order.status,
        paymentStatus: linePaid ? "paid" : "due",
      });
    }
  }
  return lines;
}

/** Room stay folio only — accommodation (+ non-food extras). */
export function buildRoomInvoice(
  row: CheckInRecord,
  orders: FoodOrder[] = [],
): GuestInvoice {
  const bill = resolveBill(row);
  const stayOrders = stayOrdersFor(row, orders);
  const foodTotal = stayOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const settled = isStaySettled(row);

  const foodPaid = settled
    ? foodTotal
    : stayOrders
        .filter((o) => o.paymentStatus === "paid")
        .reduce((s, o) => s + (o.amount || 0), 0);

  const otherExtras = Math.max(0, (bill.extraCharges || 0) - foodTotal);
  const roomTotal = Math.max(0, bill.roomCharges + otherExtras);

  const stayPaid = Math.max(0, Number(row.amountPaid) || 0);
  // Settled checkout: room folio is paid in full.
  // Otherwise cash first covers paid food tickets; remainder applies to room.
  const roomPaidRaw = settled ? roomTotal : Math.max(0, stayPaid - foodPaid);
  const split = paymentFromSplit(roomTotal, roomPaidRaw);

  let paymentTiming: PaymentTiming = row.paymentTiming;
  if (split.balanceDue <= 0) paymentTiming = "paid_at_checkin";
  else if (split.amountPaid > 0) paymentTiming = "partial";
  else paymentTiming = "due_on_checkout";

  return {
    ...guestBase(row),
    id: `${row.id}-room`,
    number: roomInvoiceNumber(row.id, row.roomNumber, row.checkInAt),
    nights: bill.nights,
    nightlyRate: bill.nightlyRate,
    roomCharges: bill.roomCharges,
    foodLines: [],
    foodTotal: 0,
    otherExtras,
    extraCharges: otherExtras,
    totalBill: roomTotal,
    amountPaid: split.amountPaid,
    balanceDue: split.balanceDue,
    paymentStatus: split.paymentStatus,
    paymentTiming,
    type: "room",
  };
}

/** Restaurant / room-service folio only — food orders for the stay. */
export function buildFoodInvoice(
  row: CheckInRecord,
  orders: FoodOrder[] = [],
): GuestInvoice | null {
  const stayOrders = stayOrdersFor(row, orders);
  if (!stayOrders.length) return null;

  const bill = resolveBill(row);
  const settled = isStaySettled(row);
  const foodLines = buildFoodLines(stayOrders, settled);
  const foodTotal = foodLines.reduce((s, l) => s + l.amount, 0);
  if (foodTotal <= 0) return null;

  const foodPaid = settled
    ? foodTotal
    : stayOrders
        .filter((o) => o.paymentStatus === "paid")
        .reduce((s, o) => s + (o.amount || 0), 0);
  const split = paymentFromSplit(foodTotal, foodPaid);

  let paymentTiming: PaymentTiming = "due_on_checkout";
  if (split.balanceDue <= 0) paymentTiming = "paid_at_checkin";
  else if (split.amountPaid > 0) paymentTiming = "partial";

  return {
    ...guestBase(row),
    id: `${row.id}-food`,
    number: foodInvoiceNumber(row.id, row.roomNumber, row.checkInAt),
    nights: bill.nights,
    nightlyRate: bill.nightlyRate,
    roomCharges: 0,
    foodLines,
    foodTotal,
    otherExtras: 0,
    extraCharges: foodTotal,
    totalBill: foodTotal,
    amountPaid: split.amountPaid,
    balanceDue: split.balanceDue,
    paymentStatus: split.paymentStatus,
    paymentTiming,
    type: "restaurant",
  };
}

/**
 * Builds separate room and food invoices (never a combined folio).
 * Food invoice is omitted when the stay has no restaurant orders.
 * Settled checkouts treat room + food as paid (even if order flags lag).
 */
export function buildGuestInvoices(
  checkIns: CheckInRecord[],
  orders: FoodOrder[],
): GuestInvoice[] {
  const out: GuestInvoice[] = [];
  for (const row of checkIns) {
    if (row.status === "cancelled") continue;
    out.push(buildRoomInvoice(row, orders));
    const food = buildFoodInvoice(row, orders);
    if (food) out.push(food);
  }
  return out.sort((a, b) => {
    const ta = new Date(a.checkInAt).getTime();
    const tb = new Date(b.checkInAt).getTime();
    const byDate = (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    if (byDate !== 0) return byDate;
    if (a.type !== b.type) return a.type === "room" ? -1 : 1;
    return a.number.localeCompare(b.number);
  });
}

export { invoiceListStatus };
