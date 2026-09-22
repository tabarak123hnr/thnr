import { Banknote, CreditCard, Download, Eye, Globe, Printer, RefreshCw, CheckCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GuestInvoiceDocument } from "../components/invoice/GuestInvoiceDocument";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { EmptyState, PageHeader, StatCard } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { calcRoomBill, clampDiscountPercent, roundMoney, taxOptionsFromStay } from "../lib/billing";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { downloadCsv, toCsv } from "../lib/exportSpreadsheet";
import { buildGuestInvoices, buildOverallInvoices, invoiceListStatus } from "../lib/invoiceBuild";
import { downloadInvoicePdf, printInvoiceElement } from "../lib/invoiceExport";
import { formatRs } from "../lib/utils";
import {
  fetchCheckIns,
  subscribeCheckIns,
  clearRoomBill,
  type CheckInRecord,
  type PaymentMethod,
} from "../services/checkIns";
import { clearGuestFoodBill, fetchOrders, subscribeOrders, type FoodOrder } from "../services/orders";
import { subscribeTaxRates, type TaxRate } from "../services/taxRates";
import type { GuestInvoice, InvoiceListStatus, InvoiceType } from "../types/invoice";

const hotelName =
  (import.meta.env.VITE_HOTEL_NAME as string | undefined) ||
  "Tabarak Hotel & Restaurant";

const statusTone: Record<InvoiceListStatus, "success" | "warning" | "danger"> = {
  paid: "success",
  partial: "warning",
  unpaid: "danger",
};

const statusLabel: Record<InvoiceListStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function typeLabel(type: InvoiceType) {
  if (type === "restaurant") return "Food";
  if (type === "overall") return "Overall";
  return "Room";
}

function typeTone(type: InvoiceType): "gold" | "info" | "purple" {
  if (type === "restaurant") return "info";
  if (type === "overall") return "purple";
  return "gold";
}

function paymentMethodTone(method: string | null | undefined): "success" | "info" | "purple" | "default" {
  if (!method) return "default";
  const lower = method.toLowerCase();
  if (lower.includes("cash")) return "success";
  if (lower.includes("card")) return "info";
  if (lower.includes("online")) return "purple";
  return "default";
}

export function InvoicesPage() {
  const { t } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceListStatus>("all");
  const [typeFilter, setTypeFilter] = useState<InvoiceType>("overall");
  const [openInvoice, setOpenInvoice] = useState<GuestInvoice | null>(null);
  const [busy, setBusy] = useState<"print" | "pdf" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* ── Clear Bill modal state ── */
  const [clearTarget, setClearTarget] = useState<GuestInvoice | null>(null);
  const [clearPaymentMethod, setClearPaymentMethod] = useState<PaymentMethod>("cash");
  const [clearTaxSelect, setClearTaxSelect] = useState("none");
  const [clearDiscountPercent, setClearDiscountPercent] = useState("");
  const [clearBusy, setClearBusy] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const a = subscribeCheckIns(setCheckIns);
    const b = subscribeOrders(setOrders);
    const c = subscribeTaxRates(setTaxRates);
    return () => {
      a();
      b();
      c();
    };
  }, []);

  const splitInvoices = useMemo(
    () => buildGuestInvoices(checkIns, orders),
    [checkIns, orders],
  );

  const overallInvoices = useMemo(
    () => buildOverallInvoices(checkIns, orders),
    [checkIns, orders],
  );

  const invoices = typeFilter === "overall" ? overallInvoices : splitInvoices;

  useEffect(() => {
    if (!openInvoice) return;
    const next = invoices.find((inv) => inv.id === openInvoice.id);
    if (next) setOpenInvoice(next);
  }, [invoices, openInvoice?.id]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (typeFilter !== "overall" && inv.type !== typeFilter) return false;
      if (statusFilter !== "all" && invoiceListStatus(inv) !== statusFilter) return false;
      return true;
    });
  }, [invoices, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const room = splitInvoices.filter((i) => i.type === "room");
    const food = splitInvoices.filter((i) => i.type === "restaurant");
    let collected = 0;
    let openBalance = 0;
    let unpaidCount = 0;
    for (const inv of splitInvoices) {
      collected += inv.amountPaid;
      openBalance += inv.balanceDue;
      const s = invoiceListStatus(inv);
      if (s === "unpaid" || s === "partial") unpaidCount += 1;
    }
    return {
      roomCount: room.length,
      foodCount: food.length,
      overallCount: overallInvoices.length,
      collected,
      openBalance,
      unpaidCount,
      total: splitInvoices.length,
    };
  }, [splitInvoices, overallInvoices]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      const [nextCheckIns, nextOrders] = await Promise.all([
        fetchCheckIns(),
        fetchOrders(),
      ]);
      setCheckIns(nextCheckIns);
      setOrders(nextOrders);
      toastSuccess("Refreshed", "Invoices updated from the latest records.");
    } catch (err) {
      toastError(
        "Refresh failed",
        err instanceof Error ? err.message : "Could not reload invoices.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  /* ── Clear Bill helpers ── */
  const foodTaxOptions = useMemo(
    () =>
      [
        { value: "none", label: "No GST" },
        ...taxRates
          .filter((t) => t.active && t.appliesToFood)
          .map((t) => ({
            value: t.id,
            label: `${t.name} (${t.percent}%)`,
          })),
      ],
    [taxRates],
  );

  const roomTaxOptions = useMemo(
    () => [
      { value: "none", label: "No GST" },
      ...taxRates
        .filter((t) => t.active && t.appliesToRoom)
        .map((t) => ({ value: t.id, label: `${t.name} (${t.percent}%)` })),
    ],
    [taxRates],
  );

  const clearNeedsPaymentDetails =
    clearTarget?.type === "restaurant" || clearTarget?.paymentTiming === "due_on_checkout";

  const clearTaxRate = useMemo(() => {
    if (clearTaxSelect === "none") return null;
    return taxRates.find((t) => t.id === clearTaxSelect) ?? null;
  }, [taxRates, clearTaxSelect]);

  const clearPreview = useMemo(() => {
    if (!clearTarget) return { subtotal: 0, gst: 0, total: 0 };
    if (clearTarget.type === "room") {
      const bill = calcRoomBill(
        clearTarget.nightlyRate,
        clearTarget.checkInAt,
        clearTarget.checkOutAt,
        clearTarget.otherExtras,
        clampDiscountPercent(clearDiscountPercent),
        {
          ...taxOptionsFromStay(clearTarget),
          taxPercent: clearTaxRate?.percent ?? 0,
          taxAppliesToFood: false,
        },
      );
      return {
        subtotal: bill.roomChargesBefore + bill.extraCharges,
        gst: bill.taxAmount,
        total: bill.totalBill,
      };
    }
    const subtotal = clearTarget.foodTotal;
    const pct = clearTaxRate?.percent ?? 0;
    const gst = pct > 0 ? roundMoney((subtotal * pct) / 100) : 0;
    return { subtotal, gst, total: roundMoney(subtotal + gst) };
  }, [clearTarget, clearTaxRate, clearDiscountPercent]);

  function openClearBill(inv: GuestInvoice) {
    setClearTarget(inv);
    setClearPaymentMethod("cash");
    setClearTaxSelect("none");
    setClearDiscountPercent("");
    setClearBusy(false);
  }

  async function onConfirmClearBill() {
    if (!clearTarget) return;
    setClearBusy(true);
    try {
      const result = clearTarget.type === "room"
        ? await clearRoomBill(clearTarget.checkInId, clearNeedsPaymentDetails ? {
            discountPercent: clampDiscountPercent(clearDiscountPercent),
            taxPercent: clearTaxRate?.percent ?? 0,
            taxLabel: clearTaxRate?.name,
            taxRateId: clearTaxRate?.id ?? null,
            paymentMethod: clearPaymentMethod,
          } : undefined)
        : await clearGuestFoodBill(clearTarget.checkInId, {
            taxPercent: clearTaxRate?.percent ?? 0,
            taxLabel: clearTaxRate?.name,
            taxRateId: clearTaxRate?.id ?? null,
            paymentMethod: clearPaymentMethod,
          });
      const settledTotal = "totalBill" in result ? result.totalBill : result.folioTotal;
      toastSuccess(
        clearTarget.type === "room" ? "Room bill cleared" : "Food bill cleared",
        `${result.guestName} · Room ${result.roomNumber} — ${formatRs(settledTotal, t.common.rs)} settled`,
      );
      setClearTarget(null);
    } catch (err) {
      toastError(
        "Clear bill failed",
        err instanceof Error ? err.message : "Could not settle this food bill.",
      );
    } finally {
      setClearBusy(false);
    }
  }

  async function onPrint() {
    if (!sheetRef.current || !openInvoice) return;
    setBusy("print");
    try {
      printInvoiceElement(sheetRef.current, openInvoice.number);
    } catch (err) {
      toastError(
        "Print failed",
        err instanceof Error ? err.message : "Allow pop-ups and try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onDownloadPdf() {
    if (!sheetRef.current || !openInvoice) return;
    setBusy("pdf");
    try {
      await downloadInvoicePdf(
        sheetRef.current,
        `${openInvoice.number.replace(/[^\w.-]+/g, "_")}.pdf`,
      );
      toastSuccess("Downloaded", `${openInvoice.number}.pdf`);
    } catch (err) {
      toastError(
        "Download failed",
        err instanceof Error ? err.message : "Could not create PDF.",
      );
    } finally {
      setBusy(null);
    }
  }

  function onExportList() {
    if (!filtered.length) {
      toastError("Nothing to export", "No invoices match this filter.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `tabarak-invoices-${stamp}.csv`,
      toCsv(filtered, [
        { header: "Invoice", value: (r) => r.number },
        { header: "Guest", value: (r) => r.guestName },
        { header: "Room", value: (r) => r.roomNumber },
        { header: "Type", value: (r) => typeLabel(r.type) },
        { header: "Check-in", value: (r) => r.checkInAt },
        { header: "Check-out", value: (r) => r.checkOutAt },
        { header: "Total", value: (r) => r.totalBill },
        { header: "Paid", value: (r) => r.amountPaid },
        { header: "Balance", value: (r) => r.balanceDue },
        { header: "Status", value: (r) => invoiceListStatus(r) },
      ]),
    );
    toastSuccess("Exported", "Invoice list CSV downloaded.");
  }

  return (
    <div>
      <PageHeader
        title={t.pages.invoicesTitle}
        subtitle={t.pages.invoicesSub}
        actions={
          <>
            <Button
              variant="secondary"
              className="w-full cursor-pointer sm:w-auto"
              icon={
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
              }
              disabled={refreshing}
              onClick={() => void onRefresh()}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              variant="secondary"
              className="w-full cursor-pointer sm:w-auto"
              icon={<Download className="h-4 w-4" />}
              onClick={onExportList}
            >
              {t.common.export}
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Overall invoices" value={String(stats.overallCount)} />
        <StatCard label="Room invoices" value={String(stats.roomCount)} />
        <StatCard label="Food invoices" value={String(stats.foodCount)} />
        <StatCard
          label="Collected"
          value={formatRs(stats.collected, t.common.rs)}
        />
        <StatCard
          label="Open balance"
          value={formatRs(stats.openBalance, t.common.rs)}
          alert={stats.unpaidCount || undefined}
          hint={`${stats.unpaidCount} unpaid / partial`}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["overall", "Overall"],
            ["room", "Room"],
            ["restaurant", "Food"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={typeFilter === value ? "gold" : "secondary"}
            onClick={() => setTypeFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "All status"],
            ["unpaid", "Unpaid"],
            ["partial", "Partial"],
            ["paid", "Paid"],
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
          <EmptyState message="No invoices yet. Check in a guest for an overall or room invoice; food invoices appear after counter orders." />
        ) : (
          <Table
            headers={[
              "Invoice",
              t.common.guest,
              t.common.type,
              t.common.date,
              t.common.amount,
              t.common.paid,
              "Payment",
              t.status,
              t.common.actions,
            ]}
            colWidths={["15%", "13%", "7%", "10%", "10%", "10%", "9%", "9%", "17%"]}
          >
            {filtered.map((inv) => {
              const status = invoiceListStatus(inv);
              return (
                <Tr key={inv.id}>
                  <Td className="font-bold font-mono text-xs sm:text-sm">
                    {inv.number}
                  </Td>
                  <Td>
                    <div className="font-semibold">{inv.guestName}</div>
                    <div className="text-xs text-muted">Room {inv.roomNumber}</div>
                  </Td>
                  <Td>
                    <Badge tone={typeTone(inv.type)}>{typeLabel(inv.type)}</Badge>
                  </Td>
                  <Td className="text-muted">{formatDate(inv.checkInAt)}</Td>
                  <Td className="font-semibold">
                    {formatRs(inv.totalBill, t.common.rs)}
                    {inv.type !== "restaurant" && inv.discountPercent > 0 ? (
                      <div className="text-[11px] font-normal text-muted">
                        {inv.discountPercent}% off
                      </div>
                    ) : null}
                  </Td>
                  <Td>{formatRs(inv.amountPaid, t.common.rs)}</Td>
                  <Td>
                    {inv.paymentMethod ? (
                      <Badge tone={paymentMethodTone(inv.paymentMethod)} className="capitalize">
                        {inv.paymentMethod}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Button
                        size="sm"
                        className="cursor-pointer whitespace-nowrap !bg-sky-600 !text-white hover:!bg-sky-500 shadow-xs"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => setOpenInvoice(inv)}
                      >
                        Open
                      </Button>
                      {inv.type !== "overall" && status !== "paid" ? (
                        <Button
                          size="sm"
                          className="cursor-pointer whitespace-nowrap !bg-emerald-600 !text-white hover:!bg-emerald-500 shadow-xs"
                          icon={<CheckCircle className="h-3.5 w-3.5" />}
                          onClick={() => openClearBill(inv)}
                        >
                          Clear Bill
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Modal
        open={Boolean(openInvoice)}
        onClose={() => setOpenInvoice(null)}
        title={openInvoice?.number ?? "Invoice"}
        subtitle={
          openInvoice
            ? `${openInvoice.guestName} · Room ${openInvoice.roomNumber} · ${typeLabel(openInvoice.type)}`
            : undefined
        }
        wide
        xl
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenInvoice(null)}>
              Close
            </Button>
            <Button
              variant="secondary"
              className="cursor-pointer"
              icon={<Printer className="h-4 w-4" />}
              disabled={busy !== null}
              onClick={() => void onPrint()}
            >
              {busy === "print" ? "Opening…" : "Print"}
            </Button>
            <Button
              variant="gold"
              className="cursor-pointer"
              icon={<Download className="h-4 w-4" />}
              disabled={busy !== null}
              onClick={() => void onDownloadPdf()}
            >
              {busy === "pdf" ? "Preparing…" : "Download PDF"}
            </Button>
          </>
        }
      >
        {openInvoice ? (
          <div className="max-h-[70vh] overflow-auto rounded-xl bg-white p-3 sm:p-5">
            <GuestInvoiceDocument
              ref={sheetRef}
              invoice={openInvoice}
              hotelName={hotelName}
              rs={t.common.rs}
            />
          </div>
        ) : null}
      </Modal>

      {/* ── Clear Food Bill Modal ── */}
      <Modal
        open={Boolean(clearTarget)}
        onClose={() => !clearBusy && setClearTarget(null)}
        title={clearTarget?.type === "room" ? "Clear Room Bill" : "Clear Food Bill"}
        subtitle={
          clearTarget
            ? `${clearTarget.guestName} · Room ${clearTarget.roomNumber}`
            : undefined
        }
        wide
        footer={
          <>
            <Button
              variant="secondary"
              disabled={clearBusy}
              onClick={() => setClearTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer whitespace-nowrap !bg-emerald-600 !text-white hover:!bg-emerald-500 shadow-xs font-semibold"
              icon={<CheckCircle className="h-4 w-4" />}
              disabled={clearBusy}
              onClick={() => void onConfirmClearBill()}
            >
              {clearBusy ? "Clearing…" : "Confirm & Clear"}
            </Button>
          </>
        }
      >
        {clearTarget ? (
          <div className="space-y-5">
            {clearTarget.type === "room" && clearNeedsPaymentDetails ? (
              <div>
                <label className="mb-2 block text-sm font-semibold">Room discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={clearDiscountPercent}
                  onChange={(e) => setClearDiscountPercent(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-app bg-app px-3 py-2 text-sm"
                />
                <p className="mt-2 text-xs text-muted">
                  Applied to room price plus room GST, like check-in billing.
                </p>
              </div>
            ) : null}
            {clearNeedsPaymentDetails ? (
            <div>
              <label className="mb-2 block text-sm font-semibold">Payment Method</label>
              <div className="flex gap-2">
                {(
                  [
                    ["cash", "Cash", <Banknote key="b" className="h-4 w-4" />],
                    ["card", "Card", <CreditCard key="c" className="h-4 w-4" />],
                    ["online", "Online", <Globe key="o" className="h-4 w-4" />],
                  ] as const
                ).map(([method, label, icon]) => (
                  <Button
                    key={method}
                    size="sm"
                    variant={clearPaymentMethod === method ? "gold" : "secondary"}
                    className="cursor-pointer flex-1"
                    icon={icon}
                    onClick={() => setClearPaymentMethod(method)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            ) : null}

            {clearNeedsPaymentDetails ? (
            <div>
              <label className="mb-2 block text-sm font-semibold">GST / Tax Rate</label>
              <FancySelect
                value={clearTaxSelect}
                onChange={setClearTaxSelect}
                options={clearTarget.type === "room" ? roomTaxOptions : foodTaxOptions}
                placeholder="Select tax rate…"
              />
              <p className="mt-2 text-xs text-muted">
                Choose No GST to keep this bill tax-free, or pick a GST rate to add tax before clearing it.
              </p>
            </div>
            ) : null}

            {/* Preview */}
            <div className="rounded-xl border border-app bg-elevated p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                Bill Preview
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">
                    {clearTarget.type === "room" ? "Room subtotal" : "Food subtotal"}
                  </span>
                  <span className="font-semibold">
                    {formatRs(clearPreview.subtotal, t.common.rs)}
                  </span>
                </div>
                {clearPreview.gst > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted">
                      {clearTaxRate?.name || "GST"} ({clearTaxRate?.percent ?? 0}%)
                    </span>
                    <span className="font-semibold">
                      {formatRs(clearPreview.gst, t.common.rs)}
                    </span>
                  </div>
                ) : null}
                <div className="mt-2 flex justify-between border-t border-app pt-2 text-base font-extrabold">
                  <span>Total to collect</span>
                  <span>{formatRs(clearPreview.total, t.common.rs)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
