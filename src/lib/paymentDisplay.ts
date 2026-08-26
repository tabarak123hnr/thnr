import type { CheckInRecord, PaymentStatus, PaymentTiming } from "../types/checkIn";
import { formatRs } from "./utils";

export type PaymentBadgeTone = "success" | "warning" | "danger" | "muted" | "info";

/** Single source of truth for payment status labels across the app. */
export function paymentStatusLabel(status: PaymentStatus | string): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "due":
      return "Due";
    case "pending":
      return "Due on checkout";
    default:
      return String(status || "—");
  }
}

export function paymentStatusTone(status: PaymentStatus | string): PaymentBadgeTone {
  switch (status) {
    case "paid":
      return "success";
    case "partial":
      return "warning";
    case "due":
      return "danger";
    case "pending":
      return "warning";
    default:
      return "muted";
  }
}

export function paymentPlanLabel(timing: PaymentTiming | string): string {
  switch (timing) {
    case "paid_at_checkin":
      return "Full cash at check-in";
    case "partial":
      return "Partial (some now, rest later)";
    case "due_on_checkout":
      return "Full due on checkout";
    default:
      return String(timing || "—");
  }
}

export function resolveAmountPaid(row: Pick<CheckInRecord, "amountPaid" | "paymentStatus" | "totalBill">) {
  if (typeof row.amountPaid === "number" && Number.isFinite(row.amountPaid)) {
    return Math.max(0, row.amountPaid);
  }
  return row.paymentStatus === "paid" ? Math.max(0, row.totalBill || 0) : 0;
}

export function resolveBalanceDue(
  row: Pick<CheckInRecord, "balanceDue" | "amountPaid" | "paymentStatus" | "totalBill">,
) {
  if (typeof row.balanceDue === "number" && Number.isFinite(row.balanceDue)) {
    return Math.max(0, row.balanceDue);
  }
  const total = Math.max(0, row.totalBill || 0);
  const paid = resolveAmountPaid(row);
  if (row.paymentStatus === "paid") return 0;
  return Math.max(0, total - paid);
}

export function isBillFullyPaid(
  row: Pick<CheckInRecord, "paymentStatus" | "balanceDue" | "amountPaid" | "totalBill">,
) {
  return row.paymentStatus === "paid" || resolveBalanceDue(row) <= 0;
}

/** Short line: Paid Rs X · Due Rs Y */
export function paymentSplitLine(
  row: Pick<CheckInRecord, "amountPaid" | "balanceDue" | "paymentStatus" | "totalBill">,
  rs: string,
) {
  const paid = resolveAmountPaid(row);
  const due = resolveBalanceDue(row);
  return `Paid ${formatRs(paid, rs)} · Due ${formatRs(due, rs)}`;
}

export function paymentBadge(row: Pick<CheckInRecord, "paymentStatus">) {
  return {
    tone: paymentStatusTone(row.paymentStatus),
    label: paymentStatusLabel(row.paymentStatus),
  };
}
