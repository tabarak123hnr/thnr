import { calcRoomBill, roundMoney, taxOptionsFromStay } from "./billing";
import type { CheckInRecord, PaymentMethod, PaymentStatus, PaymentTiming } from "../types/checkIn";
import { type FoodOrder } from "../types/order";
import type { MiscBill } from "../types/miscBill";
import {
  invoiceListStatus,
  type GuestInvoice,
  type InvoiceFoodLine,
  type InvoiceMiscLine,
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

/** GST on the guest’s overall food total (not per kitchen ticket). */
function foodGstForStay(row: CheckInRecord, foodTotal: number) {
  const pct = Number(row.foodTaxPercent ?? 0) || 0;
  if (pct <= 0 || foodTotal <= 0) {
    return { taxAmount: 0, taxPercent: 0, taxLabel: "" };
  }
  const taxAmount = roundMoney((foodTotal * pct) / 100);
  const taxLabel =
    (row.foodTaxLabel || "").trim() || `GST ${pct}%`;
  return { taxAmount, taxPercent: pct, taxLabel };
}

function formatPaymentMethodName(m: PaymentMethod | string | null | undefined): string {
  if (!m) return "";
  const s = String(m).trim().toLowerCase();
  if (s === "cash") return "Cash";
  if (s === "card") return "Card";
  if (s === "online") return "Online";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function resolveRoomPaymentMethod(row: CheckInRecord, settled: boolean): string | null {
  if (row.roomBillPaymentMethod) return formatPaymentMethodName(row.roomBillPaymentMethod);
  const inMethod = row.checkInPaymentMethod ? formatPaymentMethodName(row.checkInPaymentMethod) : null;
  const outMethod = row.checkoutPaymentMethod ? formatPaymentMethodName(row.checkoutPaymentMethod) : null;
  if (inMethod && outMethod && inMethod !== outMethod) {
    return `${inMethod}, ${outMethod}`;
  }
  if (settled && outMethod) return outMethod;
  if (outMethod) return outMethod;
  if (inMethod) return inMethod;
  return null;
}

function resolveFoodPaymentMethod(row: CheckInRecord, settled: boolean): string | null {
  if (row.foodBillPaymentMethod) {
    return formatPaymentMethodName(row.foodBillPaymentMethod);
  }
  if (settled && row.checkoutPaymentMethod) {
    return formatPaymentMethodName(row.checkoutPaymentMethod);
  }
  if (row.checkInPaymentMethod && (row.paymentStatus === "paid" || row.paymentTiming === "paid_at_checkin")) {
    return formatPaymentMethodName(row.checkInPaymentMethod);
  }
  return null;
}

function resolveOverallPaymentMethod(row: CheckInRecord): string | null {
  const methods = new Set<string>();
  if (row.checkInPaymentMethod) methods.add(formatPaymentMethodName(row.checkInPaymentMethod));
  if (row.checkoutPaymentMethod) methods.add(formatPaymentMethodName(row.checkoutPaymentMethod));
  if (row.foodBillPaymentMethod) methods.add(formatPaymentMethodName(row.foodBillPaymentMethod));
  if (!methods.size) return null;
  return Array.from(methods).join(", ");
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

  const foodTax = foodGstForStay(row, foodPretax).taxAmount;
  const foodPaidTickets = settled || row.foodBillClearedAt
    ? roundMoney(foodPretax + foodTax)
    : stayOrders
        .filter((o) => o.paymentStatus === "paid")
        .reduce((s, o) => s + (o.amount || 0), 0);

  const otherExtras = Math.max(0, (bill.extraCharges || 0) - foodPretax);
  const pct = bill.taxPercent || 0;

  // Room tax only — do not re-tax food (food GST is on the food folio)
  const roomTax = bill.taxAppliesToRoom
    ? roundMoney((bill.roomChargesBefore * pct) / 100)
    : 0;
  // Only room-side extras belong to the room folio; food GST is separate.
  const otherExtrasTax =
    otherExtras > 0 && pct > 0 && bill.taxAppliesToRoom
      ? roundMoney((otherExtras * pct) / 100)
      : 0;
  const taxAmount = roundMoney(roomTax + otherExtrasTax);
  const discount = roundMoney(bill.discountAmount || 0);
  const roomTotal = roundMoney(
    Math.max(0, bill.roomChargesBefore + otherExtras + taxAmount - discount),
  );

  const stayPaid = Math.max(0, Number(row.amountPaid) || 0);
  const roomPaidRaw = row.roomBillClearedAt || settled
    ? roomTotal
    : Math.max(0, stayPaid - foodPaidTickets);
  const split = paymentFromSplit(roomTotal, roomPaidRaw);
  const roomCleared = Boolean(row.roomBillClearedAt);

  let paymentTiming: PaymentTiming = row.paymentTiming;
  if (roomCleared || split.balanceDue <= 0) paymentTiming = "paid_at_checkin";
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
    roomTaxAmount: taxAmount,
    foodTaxAmount: 0,
    totalBill: roomTotal,
    amountPaid: split.amountPaid,
    balanceDue: split.balanceDue,
    paymentStatus: split.paymentStatus,
    paymentTiming,
    paymentMethod: resolveRoomPaymentMethod(row, settled),
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

  const foodServiceCharge = Math.max(0, Number(row.foodServiceCharge) || 0);
  const { taxAmount, taxPercent, taxLabel: foodTaxLabel } = foodGstForStay(
    row,
    foodTotal + foodServiceCharge,
  );
  const folioTotal = roundMoney(foodTotal + foodServiceCharge + taxAmount);

  const foodCleared = Boolean(row.foodBillClearedAt);
  const foodPaidPretax = settled
    ? foodTotal
    : stayOrders
        .filter((o) => o.paymentStatus === "paid")
        .reduce((s, o) => s + (o.amount || 0), 0);
  const foodPaid =
    foodCleared || settled
      ? folioTotal
      : taxAmount > 0 && foodTotal > 0
        ? roundMoney(foodPaidPretax + (foodPaidPretax / foodTotal) * taxAmount)
        : foodPaidPretax;
  const split = paymentFromSplit(folioTotal, foodPaid);

  let paymentTiming: PaymentTiming = "due_on_checkout";
  if (split.balanceDue <= 0) paymentTiming = "paid_at_checkin";
  else if (split.amountPaid > 0) paymentTiming = "partial";

  const base = guestBase(row);

  return {
    ...base,
    taxPercent,
    taxLabel: taxAmount > 0 ? foodTaxLabel : "",
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
    foodServiceCharge,
    otherExtras: 0,
    extraCharges: foodTotal,
    taxAmount,
    roomTaxAmount: 0,
    foodTaxAmount: taxAmount,
    totalBill: folioTotal,
    amountPaid: split.amountPaid,
    balanceDue: split.balanceDue,
    paymentStatus: split.paymentStatus,
    paymentTiming,
    paymentMethod: resolveFoodPaymentMethod(row, settled),
    billClearedAt: row.foodBillClearedAt,
    type: "restaurant",
  };
}

/** Miscellaneous folio — laundry, bedsheet, etc. strictly WITHOUT GST. */
export function buildMiscInvoice(
  bill: MiscBill,
  checkIn?: CheckInRecord,
): GuestInvoice {
  const settled = checkIn ? isStaySettled(checkIn) : bill.paymentStatus === "paid";
  const totalAmount = bill.totalAmount;
  const amountPaid = settled || bill.paymentStatus === "paid" ? totalAmount : bill.amountPaid;
  const split = paymentFromSplit(totalAmount, amountPaid);

  const miscLines: InvoiceMiscLine[] = bill.items.map((it) => ({
    billNumber: bill.billNumber,
    name: it.name,
    qty: it.qty,
    unitPrice: it.unitPrice,
    amount: it.amount,
    paymentStatus: split.paymentStatus === "paid" ? "paid" : "due",
  }));

  let paymentTiming: PaymentTiming = "due_on_checkout";
  if (split.balanceDue <= 0) paymentTiming = "paid_at_checkin";
  else if (split.amountPaid > 0) paymentTiming = "partial";

  return {
    id: `${bill.id}-misc`,
    checkInId: bill.checkInId,
    number: bill.billNumber,
    issuedAt: bill.createdAt,
    guestName: bill.guestName || checkIn?.guestName || "Guest",
    phone: checkIn?.phone || "",
    email: checkIn?.email || "",
    cnic: checkIn?.cnic || "",
    nationality: checkIn?.nationality || "",
    roomNumber: bill.roomNumber || checkIn?.roomNumber || "—",
    checkInAt: checkIn?.checkInAt || bill.createdAt,
    checkOutAt: checkIn?.checkedOutAt || checkIn?.checkOutAt || bill.createdAt,
    nights: 0,
    nightlyRate: 0,
    discountedNightlyRate: 0,
    discountPercent: 0,
    discountAmount: 0,
    roomChargesBefore: 0,
    roomCharges: 0,
    foodLines: [],
    foodTotal: 0,
    miscLines,
    miscTotal: totalAmount,
    miscPaid: split.amountPaid,
    otherExtras: 0,
    extraCharges: totalAmount,
    taxLabel: "No GST",
    taxPercent: 0,
    taxAmount: 0,
    roomTaxAmount: 0,
    foodTaxAmount: 0,
    taxAppliesToRoom: false,
    taxAppliesToFood: false,
    totalBill: totalAmount,
    amountPaid: split.amountPaid,
    balanceDue: split.balanceDue,
    paymentStatus: split.paymentStatus,
    paymentTiming,
    stayStatus: checkIn?.status ?? "checked_in",
    type: "miscellaneous",
    notes: bill.notes || "",
    adults: checkIn?.adults ?? 1,
    children: checkIn?.children ?? 0,
    paymentMethod: bill.paymentMethod ? formatPaymentMethodName(bill.paymentMethod) : null,
  };
}

/** One folio for the stay: room + food + miscellaneous together (no GST on misc). */
export function buildOverallInvoice(
  row: CheckInRecord,
  orders: FoodOrder[] = [],
  miscBills: MiscBill[] = [],
): GuestInvoice {
  const room = buildRoomInvoice(row, orders);
  const food = buildFoodInvoice(row, orders);
  const foodTotal = food?.foodTotal ?? 0;
  const foodPaid = food?.amountPaid ?? 0;

  // Miscellaneous charges for this stay (Exempt from GST)
  const stayMiscBills = miscBills.filter((m) => m.checkInId === row.id);
  const settled = isStaySettled(row);
  const miscLines: InvoiceMiscLine[] = [];
  for (const bill of stayMiscBills) {
    const billPaid = settled || bill.paymentStatus === "paid";
    for (const it of bill.items) {
      miscLines.push({
        billNumber: bill.billNumber,
        name: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        amount: it.amount,
        paymentStatus: billPaid ? "paid" : "due",
      });
    }
  }
  const miscTotal = roundMoney(stayMiscBills.reduce((s, b) => s + b.totalAmount, 0));
  const miscPaid = settled
    ? miscTotal
    : roundMoney(stayMiscBills.reduce((s, b) => s + (b.paymentStatus === "paid" ? b.totalAmount : b.amountPaid), 0));

  // Taxes are ONLY from room and food. Miscellaneous is strictly 0% GST (tax-exempt).
  const taxAmount = roundMoney(room.taxAmount + (food?.taxAmount ?? 0));
  const totalBill = Math.max(0, roundMoney(room.totalBill + (food?.totalBill ?? 0) + miscTotal));
  const amountPaid = Math.max(0, roundMoney(room.amountPaid + foodPaid + miscPaid));
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
    miscLines,
    miscTotal,
    miscPaid,
    extraCharges: room.otherExtras + foodTotal + miscTotal,
    taxAmount,
    roomTaxAmount: room.roomTaxAmount,
    foodTaxAmount: food?.foodTaxAmount ?? 0,
    taxPercent: food?.taxPercent || room.taxPercent,
    taxLabel: room.taxLabel || food?.taxLabel || "",
    totalBill,
    amountPaid: split.amountPaid,
    balanceDue: split.balanceDue,
    paymentStatus: split.paymentStatus,
    paymentTiming,
    paymentMethod: resolveOverallPaymentMethod(row),
    type: "overall",
  };
}

/**
 * Builds separate room, food, and miscellaneous invoices.
 * Food invoice is omitted when the stay has no restaurant orders.
 * Settled checkouts treat bills as paid.
 */
export function buildGuestInvoices(
  checkIns: CheckInRecord[],
  orders: FoodOrder[],
  miscBills: MiscBill[] = [],
): GuestInvoice[] {
  const out: GuestInvoice[] = [];
  const checkInMap = new Map<string, CheckInRecord>();
  for (const row of checkIns) {
    if (row.status === "cancelled") continue;
    checkInMap.set(row.id, row);
    out.push(buildRoomInvoice(row, orders));
    const food = buildFoodInvoice(row, orders);
    if (food) out.push(food);
  }
  for (const bill of miscBills) {
    const parentCheckIn = checkInMap.get(bill.checkInId);
    out.push(buildMiscInvoice(bill, parentCheckIn));
  }
  return out.sort((a, b) => {
    const ta = new Date(a.checkInAt).getTime();
    const tb = new Date(b.checkInAt).getTime();
    const byDate = (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    if (byDate !== 0) return byDate;
    if (a.type !== b.type) {
      if (a.type === "room") return -1;
      if (b.type === "room") return 1;
      if (a.type === "restaurant") return -1;
      if (b.type === "restaurant") return 1;
      return 0;
    }
    return a.number.localeCompare(b.number);
  });
}

/** One combined invoice per stay (room + food + misc). */
export function buildOverallInvoices(
  checkIns: CheckInRecord[],
  orders: FoodOrder[],
  miscBills: MiscBill[] = [],
): GuestInvoice[] {
  return checkIns
    .filter((row) => row.status !== "cancelled")
    .map((row) => buildOverallInvoice(row, orders, miscBills))
    .sort((a, b) => {
      const ta = new Date(a.checkInAt).getTime();
      const tb = new Date(b.checkInAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
}

export { invoiceListStatus };

