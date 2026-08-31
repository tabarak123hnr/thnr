import { Download, Eye, Printer, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GuestInvoiceDocument } from "../components/invoice/GuestInvoiceDocument";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { EmptyState, PageHeader, StatCard } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { downloadCsv, toCsv } from "../lib/exportSpreadsheet";
import { buildGuestInvoices, invoiceListStatus } from "../lib/invoiceBuild";
import { downloadInvoicePdf, printInvoiceElement } from "../lib/invoiceExport";
import { formatRs } from "../lib/utils";
import {
  fetchCheckIns,
  subscribeCheckIns,
  type CheckInRecord,
} from "../services/checkIns";
import { fetchOrders, subscribeOrders, type FoodOrder } from "../services/orders";
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
  return type === "restaurant" ? "Food" : "Room";
}

function typeTone(type: InvoiceType): "gold" | "info" {
  return type === "restaurant" ? "info" : "gold";
}

export function InvoicesPage() {
  const { t } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceListStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | InvoiceType>("all");
  const [openInvoice, setOpenInvoice] = useState<GuestInvoice | null>(null);
  const [busy, setBusy] = useState<"print" | "pdf" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const a = subscribeCheckIns(setCheckIns);
    const b = subscribeOrders(setOrders);
    return () => {
      a();
      b();
    };
  }, []);

  const invoices = useMemo(
    () => buildGuestInvoices(checkIns, orders),
    [checkIns, orders],
  );

  useEffect(() => {
    if (!openInvoice) return;
    const next = invoices.find((inv) => inv.id === openInvoice.id);
    if (next) setOpenInvoice(next);
  }, [invoices, openInvoice?.id]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (typeFilter !== "all" && inv.type !== typeFilter) return false;
      if (statusFilter !== "all" && invoiceListStatus(inv) !== statusFilter) return false;
      return true;
    });
  }, [invoices, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const room = invoices.filter((i) => i.type === "room");
    const food = invoices.filter((i) => i.type === "restaurant");
    let collected = 0;
    let openBalance = 0;
    let unpaidCount = 0;
    for (const inv of invoices) {
      collected += inv.amountPaid;
      openBalance += inv.balanceDue;
      const s = invoiceListStatus(inv);
      if (s === "unpaid" || s === "partial") unpaidCount += 1;
    }
    return {
      roomCount: room.length,
      foodCount: food.length,
      collected,
      openBalance,
      unpaidCount,
      total: invoices.length,
    };
  }, [invoices]);

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
        subtitle="Separate room and food invoices — each stay can have both, never mixed on one bill."
        actions={
          <>
            <Button
              variant="secondary"
              className="cursor-pointer"
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
              className="cursor-pointer"
              icon={<Download className="h-4 w-4" />}
              onClick={onExportList}
            >
              {t.common.export}
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            ["all", "All types"],
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
          <EmptyState message="No invoices yet. Check in a guest for a room invoice; food invoices appear after counter orders." />
        ) : (
          <Table
            headers={[
              "Invoice",
              t.common.guest,
              t.common.type,
              t.common.date,
              t.common.amount,
              t.common.paid,
              t.status,
              t.common.actions,
            ]}
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
                  </Td>
                  <Td>{formatRs(inv.amountPaid, t.common.rs)}</Td>
                  <Td>
                    <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500"
                      icon={<Eye className="h-3.5 w-3.5" />}
                      onClick={() => setOpenInvoice(inv)}
                    >
                      Open
                    </Button>
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
          <div className="max-h-[70vh] overflow-auto rounded-xl bg-[#e8e4dc] p-3 sm:p-5">
            <GuestInvoiceDocument
              ref={sheetRef}
              invoice={openInvoice}
              hotelName={hotelName}
              rs={t.common.rs}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
