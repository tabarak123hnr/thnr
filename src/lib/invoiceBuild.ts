import {
  resolveAmountPaid,
  resolveBalanceDue,
} from "./paymentDisplay";
import { calcRoomBill } from "./billing";
import type { CheckInRecord } from "../types/checkIn";
import type { FoodOrder } from "../types/order";
import {
  invoiceListStatus,
  type GuestInvoice,
  type InvoiceFoodLine,
  type InvoiceType,
} from "../types/invoice";

function invoiceNumber(checkInId: string, roomNumber: string, checkInAt: string) {
  const d = new Date(checkInAt);
  const stamp = Number.isNaN(d.getTime())
    ? "--------"
    : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const short = checkInId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "XXXX";
  return `INV-${roomNumber || "RM"}-${stamp}-${short}`;
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

export function buildGuestInvoice(
  row: CheckInRecord,
  orders: FoodOrder[] = [],
): GuestInvoice {
  const bill = resolveBill(row);
  const stayOrders = orders.filter((o) => o.checkInId === row.id);
  const foodLines: InvoiceFoodLine[] = [];
  for (const order of stayOrders) {
    for (const item of order.items) {
      foodLines.push({
        orderToken: order.token,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        amount: item.lineTotal || item.qty * item.unitPrice,
        status: order.status,
      });
    }
  }
  const foodTotal = foodLines.reduce((s, l) => s + l.amount, 0);
  const otherExtras = Math.max(0, (bill.extraCharges || 0) - foodTotal);

  let type: InvoiceType = "room";
  if (foodTotal > 0 && bill.roomCharges > 0) type = "combined";
  else if (foodTotal > 0) type = "restaurant";

  const totalBill = bill.totalBill;
  const amountPaid = resolveAmountPaid({ ...row, totalBill });
  const balanceDue = resolveBalanceDue({ ...row, totalBill });

  return {
    id: row.id,
    number: invoiceNumber(row.id, row.roomNumber, row.checkInAt),
    issuedAt: new Date().toISOString(),
    guestName: row.guestName,
    phone: row.phone,
    email: row.email || "",
    cnic: row.cnic || "",
    nationality: row.nationality || "",
    roomNumber: row.roomNumber,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkedOutAt || row.checkOutAt,
    nights: bill.nights,
    nightlyRate: bill.nightlyRate,
    roomCharges: bill.roomCharges,
    foodLines,
    foodTotal,
    otherExtras,
    extraCharges: bill.extraCharges,
    totalBill,
    amountPaid,
    balanceDue,
    paymentStatus: row.paymentStatus,
    paymentTiming: row.paymentTiming,
    stayStatus: row.status,
    type,
    notes: row.notes || "",
    adults: row.adults,
    children: row.children,
  };
}

export function buildGuestInvoices(
  checkIns: CheckInRecord[],
  orders: FoodOrder[],
): GuestInvoice[] {
  return checkIns
    .filter((c) => c.status !== "cancelled")
    .map((c) => buildGuestInvoice(c, orders))
    .sort((a, b) => {
      const ta = new Date(a.checkInAt).getTime();
      const tb = new Date(b.checkInAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
}

export { invoiceListStatus };
