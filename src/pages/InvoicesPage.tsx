import {
  Banknote,
  CreditCard,
  Download,
  Eye,
  Globe,
  Printer,
  RefreshCw,
  CheckCircle,
  Plus,
  Trash2,
  Sparkles,
  Receipt,
} from "lucide-react";
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
import {
  fetchMiscBills,
  subscribeMiscBills,
  createMiscBill,
  clearMiscBill,
} from "../services/miscBills";
import type { MiscBill } from "../types/miscBill";
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
  if (type === "miscellaneous") return "Misc";
  return "Room";
}

function typeTone(type: InvoiceType): "gold" | "info" | "purple" | "warning" {
  if (type === "restaurant") return "info";
  if (type === "overall") return "purple";
  if (type === "miscellaneous") return "warning";
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
  const [miscBills, setMiscBills] = useState<MiscBill[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceListStatus>("all");
  const [typeFilter, setTypeFilter] = useState<InvoiceType>("overall");
  const [openInvoice, setOpenInvoice] = useState<GuestInvoice | null>(null);
  const [busy, setBusy] = useState<"print" | "pdf" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* ── Clear Bill modal state ── */
  const [clearTarget, setClearTarget] = useState<GuestInvoice | null>(null);
  const [clearPaymentMethod, setClearPaymentMethod] = useState<PaymentMethod>("cash");
  const [clearCardHolderName, setClearCardHolderName] = useState("");
  const [clearCardNumber, setClearCardNumber] = useState("");
  const [clearBankName, setClearBankName] = useState("");
  const [clearAccountName, setClearAccountName] = useState("");
  const [clearAccountNumber, setClearAccountNumber] = useState("");
  const [clearTaxSelect, setClearTaxSelect] = useState("none");
  const [clearDiscountPercent, setClearDiscountPercent] = useState("");
  const [clearServiceCharge, setClearServiceCharge] = useState("");
  const [clearBusy, setClearBusy] = useState(false);

  /* ── Add Miscellaneous modal state ── */
  const [miscModalOpen, setMiscModalOpen] = useState(false);
  const [miscStayId, setMiscStayId] = useState("");
  const [miscGuestName, setMiscGuestName] = useState("");
  const [miscRoomNumber, setMiscRoomNumber] = useState("");
  const [miscItems, setMiscItems] = useState<{ name: string; qty: number; unitPrice: number }[]>([]);
  const [miscPaymentTiming, setMiscPaymentTiming] = useState<"due" | "paid">("due");
  const [miscPaymentMethod, setMiscPaymentMethod] = useState<PaymentMethod>("cash");
  const [miscNotes, setMiscNotes] = useState("");
  const [miscBusy, setMiscBusy] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const a = subscribeCheckIns(setCheckIns);
    const b = subscribeOrders(setOrders);
    const c = subscribeTaxRates(setTaxRates);
    const d = subscribeMiscBills(setMiscBills);
    return () => {
      a();
      b();
      c();
      d();
    };
  }, []);

  const splitInvoices = useMemo(
    () => buildGuestInvoices(checkIns, orders, miscBills),
    [checkIns, orders, miscBills],
  );

  const overallInvoices = useMemo(
    () => buildOverallInvoices(checkIns, orders, miscBills),
    [checkIns, orders, miscBills],
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
    const misc = splitInvoices.filter((i) => i.type === "miscellaneous");
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
      miscCount: misc.length,
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
      const [nextCheckIns, nextOrders, nextMisc] = await Promise.all([
        fetchCheckIns(),
        fetchOrders(),
        fetchMiscBills(),
      ]);
      setCheckIns(nextCheckIns);
      setOrders(nextOrders);
      setMiscBills(nextMisc);
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
    clearTarget?.type === "restaurant" ||
    clearTarget?.type === "miscellaneous" ||
    clearTarget?.paymentTiming === "due_on_checkout";

  const clearTaxRate = useMemo(() => {
    if (clearTaxSelect === "none") return null;
    return taxRates.find((t) => t.id === clearTaxSelect) ?? null;
  }, [taxRates, clearTaxSelect]);

  const clearPreview = useMemo(() => {
    if (!clearTarget) return { subtotal: 0, serviceCharge: 0, gst: 0, total: 0 };
    if (clearTarget.type === "miscellaneous") {
      return { subtotal: clearTarget.totalBill, serviceCharge: 0, gst: 0, total: clearTarget.totalBill };
    }
    if (clearTarget.type === "room") {
      const bill = calcRoomBill(
        clearTarget.nightlyRate,
        clearTarget.checkInAt,
        clearTarget.checkOutAt,
        clearTarget.otherExtras + (Number(clearServiceCharge) || 0),
        clampDiscountPercent(clearDiscountPercent),
        {
          ...taxOptionsFromStay(clearTarget),
          taxPercent: clearTaxRate?.percent ?? 0,
          taxAppliesToFood: false,
        },
      );
      return {
        subtotal: bill.roomChargesBefore + bill.extraCharges - (Number(clearServiceCharge) || 0),
        serviceCharge: Number(clearServiceCharge) || 0,
        gst: bill.taxAmount,
        total: bill.totalBill,
      };
    }
    const subtotal = clearTarget.foodTotal;
    const pct = clearTaxRate?.percent ?? 0;
    const gst = pct > 0 ? roundMoney((subtotal * pct) / 100) : 0;
    return { subtotal, serviceCharge: 0, gst, total: roundMoney(subtotal + gst) };
  }, [clearTarget, clearTaxRate, clearDiscountPercent, clearServiceCharge]);

  function openClearBill(inv: GuestInvoice) {
    setClearTarget(inv);
    setClearPaymentMethod("cash");
    setClearCardHolderName("");
    setClearCardNumber("");
    setClearBankName("");
    setClearAccountName("");
    setClearAccountNumber("");
    setClearTaxSelect("none");
    setClearDiscountPercent("");
    setClearServiceCharge("");
    setClearBusy(false);
  }

  async function onConfirmClearBill() {
    if (!clearTarget) return;
    setClearBusy(true);
    try {
      if (clearTarget.type === "miscellaneous") {
        const rawId = clearTarget.id.replace(/-misc$/, "");
        const settled = await clearMiscBill(rawId, {
          paymentMethod: clearPaymentMethod,
        });
        toastSuccess(
          "Miscellaneous bill cleared",
          `${settled.guestName} · Room ${settled.roomNumber} — ${formatRs(settled.totalAmount, t.common.rs)} settled`,
        );
        setClearTarget(null);
        return;
      }
      const result = clearTarget.type === "room"
        ? await clearRoomBill(clearTarget.checkInId, clearNeedsPaymentDetails ? {
            discountPercent: clampDiscountPercent(clearDiscountPercent),
            taxPercent: clearTaxRate?.percent ?? 0,
            taxLabel: clearTaxRate?.name,
            taxRateId: clearTaxRate?.id ?? null,
            paymentMethod: clearPaymentMethod,
            serviceCharge: Number(clearServiceCharge) || 0,
            cardDetails:
              clearPaymentMethod === "card"
                ? { holderName: clearCardHolderName, cardNumber: clearCardNumber }
                : null,
            onlineDetails:
              clearPaymentMethod === "online"
                ? {
                    bankName: clearBankName,
                    accountName: clearAccountName,
                    accountNumber: clearAccountNumber,
                  }
                : null,
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
        err instanceof Error ? err.message : "Could not settle this bill.",
      );
    } finally {
      setClearBusy(false);
    }
  }

  /* ── Add Miscellaneous helpers ── */
  const activeStays = useMemo(() => {
    return checkIns
      .filter((c) => c.status === "checked_in")
      .map((c) => ({
        value: c.id,
        label: `Room ${c.roomNumber} — ${c.guestName} (${c.phone || "In house"})`,
      }));
  }, [checkIns]);

  function openNewMiscModal(presetStay?: { checkInId: string; guestName: string; roomNumber: string }) {
    if (presetStay) {
      setMiscStayId(presetStay.checkInId);
      setMiscGuestName(presetStay.guestName);
      setMiscRoomNumber(presetStay.roomNumber);
    } else {
      const firstActive = checkIns.find((c) => c.status === "checked_in");
      if (firstActive) {
        setMiscStayId(firstActive.id);
        setMiscGuestName(firstActive.guestName);
        setMiscRoomNumber(firstActive.roomNumber);
      } else {
        setMiscStayId("");
        setMiscGuestName("");
        setMiscRoomNumber("");
      }
    }
    setMiscItems([]);
    setMiscPaymentTiming("due");
    setMiscPaymentMethod("cash");
    setMiscNotes("");
    setMiscBusy(false);
    setMiscModalOpen(true);
  }

  function handleSelectStay(checkInId: string) {
    setMiscStayId(checkInId);
    const found = checkIns.find((c) => c.id === checkInId);
    if (found) {
      setMiscGuestName(found.guestName);
      setMiscRoomNumber(found.roomNumber);
    }
  }

  function addMiscItem(name = "", defaultPrice = 0) {
    setMiscItems((prev) => {
      if (prev.length === 1 && !prev[0].name.trim() && !prev[0].unitPrice) {
        return [{ name, qty: 1, unitPrice: defaultPrice }];
      }
      return [...prev, { name, qty: 1, unitPrice: defaultPrice }];
    });
  }

  function updateMiscItem(index: number, patch: Partial<{ name: string; qty: number; unitPrice: number }>) {
    setMiscItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function removeMiscItem(index: number) {
    setMiscItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const miscSubtotal = useMemo(() => {
    return roundMoney(
      miscItems.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0),
    );
  }, [miscItems]);

  async function onSaveMiscBill() {
    if (!miscGuestName.trim() || !miscRoomNumber.trim()) {
      toastError("Missing guest info", "Please enter guest name and room number.");
      return;
    }
    const valid = miscItems.filter((it) => it.name.trim() && Number(it.unitPrice) > 0);
    if (!valid.length) {
      toastError("No items added", "Add at least one item with a description and price greater than 0.");
      return;
    }

    setMiscBusy(true);
    try {
      const selectedStay = checkIns.find((c) => c.id === miscStayId);
      const bill = await createMiscBill({
        checkInId: miscStayId || "",
        roomId: selectedStay?.roomId,
        roomNumber: miscRoomNumber.trim(),
        guestName: miscGuestName.trim(),
        items: valid.map((it) => ({
          name: it.name.trim(),
          qty: Math.max(1, Number(it.qty) || 1),
          unitPrice: Math.max(0, Number(it.unitPrice) || 0),
        })),
        paymentStatus: miscPaymentTiming,
        paymentMethod: miscPaymentTiming === "paid" ? miscPaymentMethod : null,
        notes: miscNotes.trim(),
      });

      toastSuccess(
        "Miscellaneous bill added",
        `${bill.billNumber} · Room ${bill.roomNumber} — ${formatRs(bill.totalAmount, t.common.rs)}`,
      );
      setMiscModalOpen(false);
    } catch (err) {
      toastError(
        "Failed to create bill",
        err instanceof Error ? err.message : "Could not create miscellaneous bill.",
      );
    } finally {
      setMiscBusy(false);
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
              variant="gold"
              className="w-full cursor-pointer sm:w-auto"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => openNewMiscModal()}
            >
              Add Miscellaneous
            </Button>
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

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Overall invoices" value={String(stats.overallCount)} />
        <StatCard label="Room invoices" value={String(stats.roomCount)} />
        <StatCard label="Food invoices" value={String(stats.foodCount)} />
        <StatCard label="Misc invoices" value={String(stats.miscCount)} />
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
            ["miscellaneous", "Miscellaneous"],
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
                      {inv.type === "overall" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="cursor-pointer whitespace-nowrap text-xs"
                          icon={<Plus className="h-3.5 w-3.5" />}
                          onClick={() =>
                            openNewMiscModal({
                              checkInId: inv.checkInId,
                              guestName: inv.guestName,
                              roomNumber: inv.roomNumber,
                            })
                          }
                        >
                          + Misc
                        </Button>
                      ) : null}
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

      {/* ── Clear Bill Modal ── */}
      <Modal
        open={Boolean(clearTarget)}
        onClose={() => !clearBusy && setClearTarget(null)}
        title={
          clearTarget?.type === "room"
            ? "Clear Room Bill"
            : clearTarget?.type === "miscellaneous"
              ? "Clear Miscellaneous Bill"
              : "Clear Food Bill"
        }
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

            {clearTarget.type === "room" && clearNeedsPaymentDetails && clearPaymentMethod === "card" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">Cardholder name (optional)</label>
                  <input
                    value={clearCardHolderName}
                    onChange={(e) => setClearCardHolderName(e.target.value)}
                    placeholder="Name on card"
                    className="w-full rounded-xl border border-app bg-app px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">Card number (optional)</label>
                  <input
                    value={clearCardNumber}
                    onChange={(e) => setClearCardNumber(e.target.value)}
                    placeholder="Card number"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-app bg-app px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ) : null}

            {clearTarget.type === "room" && clearNeedsPaymentDetails && clearPaymentMethod === "online" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">Bank name (optional)</label>
                  <input
                    value={clearBankName}
                    onChange={(e) => setClearBankName(e.target.value)}
                    placeholder="Bank name"
                    className="w-full rounded-xl border border-app bg-app px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">Guest account name (optional)</label>
                  <input
                    value={clearAccountName}
                    onChange={(e) => setClearAccountName(e.target.value)}
                    placeholder="Account holder name"
                    className="w-full rounded-xl border border-app bg-app px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">Guest account number (optional)</label>
                  <input
                    value={clearAccountNumber}
                    onChange={(e) => setClearAccountNumber(e.target.value)}
                    placeholder="Account number"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-app bg-app px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ) : null}

            {clearNeedsPaymentDetails && clearTarget.type !== "miscellaneous" ? (
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
            ) : clearTarget.type === "miscellaneous" ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                ✓ Miscellaneous charges are tax-exempt (0% GST). No tax will be added.
              </div>
            ) : null}

            {clearTarget.type === "room" && clearNeedsPaymentDetails ? (
              <div>
                <label className="mb-2 block text-sm font-semibold">Service charges</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={clearServiceCharge}
                  onChange={(e) => setClearServiceCharge(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-app bg-app px-3 py-2 text-sm"
                />
                <p className="mt-2 text-xs text-muted">
                  Optional charges for services added to this room bill. GST will apply according to the selected rate.
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
                    {clearTarget.type === "room"
                      ? "Room subtotal"
                      : clearTarget.type === "miscellaneous"
                        ? "Miscellaneous subtotal"
                        : "Food subtotal"}
                  </span>
                  <span className="font-semibold">
                    {formatRs(clearPreview.subtotal, t.common.rs)}
                  </span>
                </div>
                {clearPreview.serviceCharge > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted">Service charges</span>
                    <span className="font-semibold">
                      {formatRs(clearPreview.serviceCharge, t.common.rs)}
                    </span>
                  </div>
                ) : null}
                {clearPreview.gst > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted">
                      {clearTaxRate?.name || "GST"} ({clearTaxRate?.percent ?? 0}%)
                    </span>
                    <span className="font-semibold">
                      {formatRs(clearPreview.gst, t.common.rs)}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between text-muted text-xs">
                    <span>GST (0% Exempt)</span>
                    <span>{formatRs(0, t.common.rs)}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t border-app pt-2 text-base font-extrabold">
                  <span>Total to collect</span>
                  <span>{formatRs(clearPreview.total, t.common.rs)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Add Miscellaneous Bill Modal ── */}
      <Modal
        open={miscModalOpen}
        onClose={() => !miscBusy && setMiscModalOpen(false)}
        title="Add Miscellaneous Bill"
        subtitle="Add laundry, bedsheet, or other guest services (tax-free / 0% GST)"
        wide
        footer={
          <>
            <Button
              variant="secondary"
              disabled={miscBusy}
              onClick={() => setMiscModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              className="cursor-pointer font-semibold"
              icon={<Receipt className="h-4 w-4" />}
              disabled={miscBusy}
              onClick={() => void onSaveMiscBill()}
            >
              {miscBusy ? "Saving…" : "Save Miscellaneous Bill"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Guest / Stay Selection */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
              Select Guest Stay (In-house)
            </label>
            {activeStays.length > 0 ? (
              <FancySelect
                value={miscStayId}
                onChange={handleSelectStay}
                options={[
                  { value: "", label: "— Select Active Stay or Enter Manually —" },
                  ...activeStays,
                ]}
                placeholder="Choose guest / room…"
              />
            ) : (
              <p className="text-xs text-muted">No active in-house stays found. You can fill in the guest and room below.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Guest Name *</label>
              <input
                type="text"
                value={miscGuestName}
                onChange={(e) => setMiscGuestName(e.target.value)}
                placeholder="e.g. Mughees"
                className="w-full rounded-xl border border-app bg-app px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Room Number *</label>
              <input
                type="text"
                value={miscRoomNumber}
                onChange={(e) => setMiscRoomNumber(e.target.value)}
                placeholder="e.g. A1 or 102"
                className="w-full rounded-xl border border-app bg-app px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Line items editor */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Bill Items ({miscItems.length})
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => addMiscItem("", 0)}
              >
                Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {miscItems.map((item, index) => {
                const lineTotal = roundMoney((Number(item.qty) || 0) * (Number(item.unitPrice) || 0));
                return (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-app bg-elevated p-2.5"
                  >
                    <div className="flex-1 min-w-[160px]">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateMiscItem(index, { name: e.target.value })}
                        placeholder="Item name (e.g. Laundry, Bedsheet)"
                        className="w-full rounded-lg border border-app bg-app px-2.5 py-1.5 text-sm"
                      />
                    </div>
                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateMiscItem(index, { qty: Math.max(1, Number(e.target.value) || 1) })}
                        placeholder="Qty"
                        className="w-full rounded-lg border border-app bg-app px-2.5 py-1.5 text-sm text-center"
                      />
                    </div>
                    <div className="w-28">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted font-semibold">
                          Rs
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={item.unitPrice || ""}
                          onChange={(e) => updateMiscItem(index, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                          placeholder="Price"
                          className="w-full rounded-lg border border-app bg-app pl-8 pr-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right font-semibold text-sm">
                      {formatRs(lineTotal, t.common.rs)}
                    </div>
                    <button
                      type="button"
                      disabled={miscItems.length <= 1}
                      onClick={() => removeMiscItem(index)}
                      className="cursor-pointer p-1.5 text-muted hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment & Tax Option */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                Payment Timing
              </label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={miscPaymentTiming === "due" ? "gold" : "secondary"}
                  className="flex-1 cursor-pointer"
                  onClick={() => setMiscPaymentTiming("due")}
                >
                  Charge to Stay (Due)
                </Button>
                <Button
                  size="sm"
                  variant={miscPaymentTiming === "paid" ? "gold" : "secondary"}
                  className="flex-1 cursor-pointer"
                  onClick={() => setMiscPaymentTiming("paid")}
                >
                  Paid Now
                </Button>
              </div>
            </div>

            {miscPaymentTiming === "paid" ? (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Payment Method
                </label>
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
                      variant={miscPaymentMethod === method ? "gold" : "secondary"}
                      className="cursor-pointer flex-1"
                      icon={icon}
                      onClick={() => setMiscPaymentMethod(method)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Billing note
                </label>
                <p className="text-xs text-muted pt-1">
                  This charge will be added to the guest's stay bill and collected at checkout.
                </p>
              </div>
            )}
          </div>

          {/* Tax Information Banner */}
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>
                <strong>0% GST Exempt:</strong> Miscellaneous services are not subject to GST and will not increase guest tax.
              </span>
            </div>
            <Badge tone="success">No GST</Badge>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Notes / Remarks (Optional)</label>
            <input
              type="text"
              value={miscNotes}
              onChange={(e) => setMiscNotes(e.target.value)}
              placeholder="e.g. Picked up by Room Service at 3 PM"
              className="w-full rounded-xl border border-app bg-app px-3 py-2 text-sm"
            />
          </div>

          {/* Summary Preview */}
          <div className="rounded-xl border border-app bg-elevated p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal ({miscItems.length} items)</span>
                <span className="font-semibold">{formatRs(miscSubtotal, t.common.rs)}</span>
              </div>
              <div className="flex justify-between text-muted text-xs">
                <span>GST (0% Exempt)</span>
                <span>{formatRs(0, t.common.rs)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-app pt-2 text-base font-extrabold">
                <span>Total Miscellaneous Bill</span>
                <span className="text-accent">{formatRs(miscSubtotal, t.common.rs)}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
