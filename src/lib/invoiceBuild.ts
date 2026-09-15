import { calcRoomBill, roundMoney, taxOptionsFromStay } from "./billing";
import type { CheckInRecord, PaymentStatus, PaymentTiming } from "../types/checkIn";
import {
  orderTaxAmount,
  orderTicketTotal,
  type FoodOrder,
} from "../types/order";
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

function overallInvoiceNumber(checkInId: string, roomNumber: string, checkInAt: string) {
  return `INV-OV-${roomNumber || "RM"}-${stampFrom(checkInAt)}-${shortId(checkInId)}`;
}

function resolveBill(row: CheckInRecord) {
  return calcRoomBill(
    row.nightlyRate,
    row.checkInAt,
    row.checkOutAt,
    row.extraCharges || 0,
    row.discountPercent || 0,
    taxOptionsFromStay(row),
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

/**
 * GST for food folio — once only per rupee of food:
 * use each ticket’s stored GST when present; otherwise stay food GST %.
 * Never add order tax and stay tax on the same ticket.
 */
function foodGstForOrders(row: CheckInRecord, stayOrders: FoodOrder[], foodTotal: number) {
  const stayPct = row.taxPercent || 0;
  const stayFood = row.taxAppliesToFood && stayPct > 0;

  let taxAmount = 0;
  let taxPercent = 0;

  for (const o of stayOrders) {
    const stored = orderTaxAmount(o);
    if (stored > 0 || (Number(o.taxPercent) || 0) > 0) {
      taxAmount += stored;
      taxPercent = Number(o.taxPercent) || taxPercent || stayPct;
    } else if (stayFood) {
      taxAmount += roundMoney(((o.amount || 0) * stayPct) / 100);
      taxPercent = stayPct;
    }
  }

  taxAmount = roundMoney(taxAmount);
  if (taxAmount <= 0 && stayFood && foodTotal > 0) {
    taxAmount = roundMoney((foodTotal * stayPct) / 100);
    taxPercent = stayPct;
  }

  return { taxAmount, taxPercent };
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
    taxLabel: row.taxLabel || (row.taxPercent > 0 ? `GST ${row.taxPercent}%` : ""),
    taxPercent: row.taxPercent || 0,
    taxAppliesToRoom: row.taxAppliesToRoom !== false,
    taxAppliesToFood: row.taxAppliesToFood !== false,
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

/**
 * Room folio — accommodation + non-food extras.
 * Food GST is never included here (lives on the food invoice only).
 */
export function buildRoomInvoice(
  row: CheckInRecord,
  orders: FoodOrder[] = [],
): GuestInvoice {
  const bill = resolveBill(row);
  const stayOrders = stayOrdersFor(row, orders);
  const foodPretax = stayOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const settled = isStaySettled(row);

  const foodPaidTickets = settled
    ? stayOrders.reduce((s, o) => s + orderTicketTotal(o), 0)
    : stayOrders
        .filter((o) => o.paymentStatus === "paid")
        .reduce((s, o) => s + orderTicketTotal(o), 0);

  const otherExtras = Math.max(0, (bill.extraCharges || 0) - foodPretax);
  const pct = bill.taxPercent || 0;

  // Room tax only — do not re-tax food (food GST is on the food folio)
  const roomTax = bill.taxAppliesToRoom
    ? roundMoney((bill.roomChargesBefore * pct) / 100)
    : 0;
  // Non-food extras follow the same rule as stay extras tax when food GST is on
  const otherExtrasTax =
    otherExtras > 0 && pct > 0 && (bill.taxAppliesToFood || bill.taxAppliesToRoom)
      ? roundMoney((otherExtras * pct) / 100)
      : 0;
  const taxAmount = roundMoney(roomTax + otherExtrasTax);
  const discount = roundMoney(bill.discountAmount || 0);
  const roomTotal = roundMoney(
    Math.max(0, bill.roomChargesBefore + otherExtras + taxAmount - discount),
  );

  const stayPaid = Math.max(0, Number(row.amountPaid) || 0);
  const roomPaidRaw = settled ? roomTotal : Math.max(0, stayPaid - foodPaidTickets);
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
    discountedNightlyRate: bill.discountedNightlyRate,
    discountPercent: bill.discountPercent,
    discountAmount: discount,
    roomChargesBefore: bill.roomChargesBefore,
    roomCharges: bill.roomCharges,
    foodLines: [],
    foodTotal: 0,
    otherExtras,
    extraCharges: otherExtras,
    taxAmount,
    totalBill: roomTotal,
    amountPaid: split.amountPaid,
    balanceDue: split.balanceDue,
    paymentStatus: split.paymentStatus,
    paymentTiming,
    type: "room",
  };
}

/** Restaurant folio — food pretax + GST once (from tickets or stay food rate). */
export function buildFoodInvoice(
  row: CheckInRecord,
  orders: FoodOrder[] = [],
): GuestInvoice | null {
  const stayOrders = stayOrdersFor(row, orders);
  if (!stayOrders.length) return null;

  const settled = isStaySettled(row);
  const foodLines = buildFoodLines(stayOrders, settled);
  const foodTotal = foodLines.reduce((s, l) => s + l.amount, 0);
  if (foodTotal <= 0) return null;

  const { taxAmount, taxPercent } = foodGstForOrders(row, stayOrders, foodTotal);
  const folioTotal = roundMoney(foodTotal + taxAmount);

  const foodPaid = settled
    ? folioTotal
    : stayOrders
        .filter((o) => o.paymentStatus === "paid")
        .reduce((s, o) => s + orderTicketTotal(o), 0);
  const split = paymentFromSplit(folioTotal, foodPaid);

  let paymentTiming: PaymentTiming = "due_on_checkout";
  if (split.balanceDue <= 0) paymentTiming = "paid_at_checkin";
  else if (split.amountPaid > 0) paymentTiming = "partial";

  const base = guestBase(row);

  return {
    ...base,
    taxPercent: taxPercent || base.taxPercent,
    taxLabel:
      taxAmount > 0
        ? base.taxLabel || `GST ${taxPercent || base.taxPercent}%`
        : "",
    id: `${row.id}-food`,
    number: foodInvoiceNumber(row.id, row.roomNumber, row.checkInAt),
    nights: 0,
    nightlyRate: 0,
    discountedNightlyRate: 0,
    discountPercent: 0,
    discountAmount: 0,
    roomChargesBefore: 0,
    roomCharges: 0,
    foodLines,
    foodTotal,
    otherExtras: 0,
    extraCharges: foodTotal,
    taxAmount,
    totalBill: folioTotal,
    amountPaid: split.amountPaid,
    balanceDue: split.balanceDue,
    paymentStatus: split.paymentStatus,
    paymentTiming,
    type: "restaurant",
  };
}

/** One folio for the stay: room + food together (tax already split cleanly). */
export function buildOverallInvoice(
  row: CheckInRecord,
  orders: FoodOrder[] = [],
): GuestInvoice {
  const room = buildRoomInvoice(row, orders);
  const food = buildFoodInvoice(row, orders);
  const foodTotal = food?.foodTotal ?? 0;
  const foodPaid = food?.amountPaid ?? 0;
  const taxAmount = roundMoney(room.taxAmount + (food?.taxAmount ?? 0));
  const totalBill = Math.max(0, room.totalBill + (food?.totalBill ?? 0));
  const amountPaid = Math.max(0, room.amountPaid + foodPaid);
  const split = paymentFromSplit(totalBill, amountPaid);

  let paymentTiming: PaymentTiming = row.paymentTiming;
  if (split.balanceDue <= 0) paymentTiming = "paid_at_checkin";
  else if (split.amountPaid > 0) paymentTiming = "partial";
  else paymentTiming = "due_on_checkout";

  return {
    ...room,
    id: `${row.id}-overall`,
    number: overallInvoiceNumber(row.id, row.roomNumber, row.checkInAt),
    foodLines: food?.foodLines ?? [],
    foodTotal,
    extraCharges: room.otherExtras + foodTotal,
    taxAmount,
    taxPercent: food?.taxPercent || room.taxPercent,
    taxLabel: room.taxLabel || food?.taxLabel || "",
    totalBill,
    amountPaid: split.amountPaid,
    balanceDue: split.balanceDue,
    paymentStatus: split.paymentStatus,
    paymentTiming,
    type: "overall",
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

/** One combined invoice per stay (room + food). */
export function buildOverallInvoices(
  checkIns: CheckInRecord[],
  orders: FoodOrder[],
): GuestInvoice[] {
  return checkIns
    .filter((row) => row.status !== "cancelled")
    .map((row) => buildOverallInvoice(row, orders))
    .sort((a, b) => {
      const ta = new Date(a.checkInAt).getTime();
      const tb = new Date(b.checkInAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
}

export { invoiceListStatus };
