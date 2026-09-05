import { Download, FileBarChart, Printer, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { EmptyState, Input, PageHeader, StatCard } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { downloadCsv, toCsv } from "../lib/exportSpreadsheet";
import {
  buildGuestReportBwHtml,
  downloadGuestReportPdf,
  printGuestReportBw,
} from "../lib/guestReportExport";
import { buildGuestInvoices, invoiceListStatus, isStaySettled } from "../lib/invoiceBuild";
import {
  paymentPlanLabel,
  paymentStatusLabel,
} from "../lib/paymentDisplay";
import { cn, formatRs } from "../lib/utils";
import { subscribeBookingRequests, type BookingRequest } from "../services/bookingRequests";
import { subscribeCheckIns, type CheckInRecord } from "../services/checkIns";
import {
  markStayFoodOrdersPaid,
  subscribeOrders,
  type FoodOrder,
} from "../services/orders";

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[\s\-_/]/g, "");
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

/** Stable key to group the same person across stays. */
export function guestIdentityKey(row: {
  cnic?: string;
  phone?: string;
  guestName?: string;
}) {
  const cnic = digits(row.cnic || "");
  if (cnic.length >= 5) return `cnic:${cnic}`;
  const phone = digits(row.phone || "");
  if (phone.length >= 7) return `phone:${phone}`;
  return `name:${normalize(row.guestName || "unknown")}`;
}

function formatDateTime(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stayStatusLabel(status: string) {
  if (status === "checked_in") return "In house";
  if (status === "checked_out") return "Checked out";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function stayStatusTone(
  status: string,
): "success" | "warning" | "danger" | "muted" | "info" {
  if (status === "checked_in") return "success";
  if (status === "checked_out") return "muted";
  if (status === "cancelled") return "danger";
  return "info";
}

/** Checkout with remaining balance paid → stay is fully settled. */
function stayBalanceDue(row: CheckInRecord) {
  return isStaySettled(row) ? 0 : Math.max(0, Number(row.balanceDue) || 0);
}

function stayAmountPaid(row: CheckInRecord) {
  if (isStaySettled(row)) {
    return Math.max(
      0,
      Number(row.amountPaid) || 0,
      Number(row.totalBill) || 0,
    );
  }
  return Math.max(0, Number(row.amountPaid) || 0);
}

type GuestProfile = {
  key: string;
  guestName: string;
  phone: string;
  cnic: string;
  nationality: string;
  email: string;
  stays: CheckInRecord[];
  bookings: BookingRequest[];
  stayCount: number;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-app px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-semibold break-all">{value || "—"}</p>
    </div>
  );
}

export function ReportsPage() {
  const { t } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"pdf" | "csv" | null>(null);

  useEffect(() => {
    const a = subscribeCheckIns(setCheckIns);
    const b = subscribeOrders(setOrders);
    const c = subscribeBookingRequests(setBookings);
    return () => {
      a();
      b();
      c();
    };
  }, []);

  // Heal legacy dues: settled checkouts must not leave food tickets as "due"
  useEffect(() => {
    const settled = checkIns.filter(isStaySettled);
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

  const settledStayIds = useMemo(
    () => new Set(checkIns.filter(isStaySettled).map((c) => c.id)),
    [checkIns],
  );

  /** Orders with payment flipped to paid when the stay was settled at checkout. */
  const effectiveOrders = useMemo(
    () =>
      orders.map((o) =>
        o.checkInId &&
        settledStayIds.has(o.checkInId) &&
        o.paymentStatus !== "paid"
          ? { ...o, paymentStatus: "paid" as const }
          : o,
      ),
    [orders, settledStayIds],
  );

  const profiles = useMemo(() => {
    const map = new Map<string, GuestProfile>();

    for (const row of checkIns) {
      if (row.status === "cancelled") continue;
      const key = guestIdentityKey(row);
      let profile = map.get(key);
      if (!profile) {
        profile = {
          key,
          guestName: row.guestName,
          phone: row.phone,
          cnic: row.cnic,
          nationality: row.nationality,
          email: row.email,
          stays: [],
          bookings: [],
          stayCount: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalDue: 0,
        };
        map.set(key, profile);
      }
      profile.stays.push(row);
      if (row.guestName) profile.guestName = row.guestName;
      if (row.phone) profile.phone = row.phone;
      if (row.cnic) profile.cnic = row.cnic;
      if (row.nationality) profile.nationality = row.nationality;
      if (row.email) profile.email = row.email;
      profile.totalBilled += Math.max(0, row.totalBill || 0);
      profile.totalPaid += stayAmountPaid(row);
      profile.totalDue += stayBalanceDue(row);
    }

    for (const b of bookings) {
      const key = guestIdentityKey({
        cnic: b.cnic,
        phone: b.phone,
        guestName: b.guestName,
      });
      let profile = map.get(key);
      if (!profile) {
        profile = {
          key,
          guestName: b.guestName,
          phone: b.phone,
          cnic: b.cnic,
          nationality: b.nationality,
          email: "",
          stays: [],
          bookings: [],
          stayCount: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalDue: 0,
        };
        map.set(key, profile);
      }
      profile.bookings.push(b);
      if (!profile.guestName && b.guestName) profile.guestName = b.guestName;
      if (!profile.phone && b.phone) profile.phone = b.phone;
      if (!profile.cnic && b.cnic) profile.cnic = b.cnic;
      if (!profile.nationality && b.nationality) profile.nationality = b.nationality;
    }

    for (const p of map.values()) {
      p.stays.sort(
        (a, b) =>
          new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime(),
      );
      p.bookings.sort(
        (a, b) =>
          new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime(),
      );
      p.stayCount = p.stays.length;
    }

    return [...map.values()].sort((a, b) =>
      a.guestName.localeCompare(b.guestName),
    );
  }, [checkIns, bookings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digits(query);
    if (!q) return profiles;
    return profiles.filter((p) => {
      const hay = `${p.guestName} ${p.phone} ${p.cnic} ${p.email} ${p.nationality}`.toLowerCase();
      if (hay.includes(q)) return true;
      if (qDigits.length >= 4) {
        return digits(p.phone).includes(qDigits) || digits(p.cnic).includes(qDigits);
      }
      return false;
    });
  }, [profiles, query]);

  const selected = useMemo(
    () => profiles.find((p) => p.key === selectedKey) ?? null,
    [profiles, selectedKey],
  );

  const selectedStayIds = useMemo(
    () => new Set(selected?.stays.map((s) => s.id) ?? []),
    [selected],
  );

  const selectedOrders = useMemo(() => {
    if (!selected) return [];
    return effectiveOrders
      .filter((o) => selectedStayIds.has(o.checkInId))
      .sort((a, b) => {
        const ta =
          a.createdAt && typeof a.createdAt === "object" && "toMillis" in a.createdAt
            ? (a.createdAt as { toMillis: () => number }).toMillis()
            : 0;
        const tb =
          b.createdAt && typeof b.createdAt === "object" && "toMillis" in b.createdAt
            ? (b.createdAt as { toMillis: () => number }).toMillis()
            : 0;
        return tb - ta;
      });
  }, [effectiveOrders, selected, selectedStayIds]);

  const selectedInvoices = useMemo(() => {
    if (!selected) return [];
    // Raw orders are fine — invoiceBuild settles food when the stay is paid out
    return buildGuestInvoices(selected.stays, orders);
  }, [selected, orders]);

  const latestStay = selected?.stays[0] ?? null;

  const foodTotals = useMemo(() => {
    let billed = 0;
    let paid = 0;
    for (const o of selectedOrders) {
      billed += o.amount || 0;
      if (o.paymentStatus === "paid") paid += o.amount || 0;
    }
    return { billed, paid, due: billed - paid };
  }, [selectedOrders]);

  /** Outstanding = open stay balances only (food on settled stays is cleared). */
  const reportOutstanding = useMemo(() => {
    if (!selected) return 0;
    const stayDue = selected.stays.reduce((s, row) => s + stayBalanceDue(row), 0);
    // Food due only for tickets still on unsettled (in-house) stays
    const openIds = new Set(
      selected.stays.filter((s) => !isStaySettled(s)).map((s) => s.id),
    );
    const foodDueOpen = selectedOrders
      .filter((o) => o.paymentStatus !== "paid" && openIds.has(o.checkInId))
      .reduce((s, o) => s + (o.amount || 0), 0);
    // Avoid double-count: stay balanceDue already includes unpaid extras/food on the folio
    return stayDue > 0 ? stayDue : foodDueOpen;
  }, [selected, selectedOrders]);

  function reportFileBase() {
    const name = (selected?.guestName || "guest")
      .replace(/[^\w\-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 40);
    const stamp = new Date().toISOString().slice(0, 10);
    return `tabarak-guest-report-${name}-${stamp}`;
  }

  function buildBwHtml() {
    if (!selected) return "";
    return buildGuestReportBwHtml({
      guestName: selected.guestName,
      phone: selected.phone,
      cnic: selected.cnic,
      email: selected.email,
      nationality: selected.nationality,
      stayCount: selected.stayCount,
      totalBilled: selected.totalBilled,
      totalPaid: selected.totalPaid,
      outstanding: reportOutstanding,
      stays: selected.stays,
      orders: selectedOrders,
      invoices: selectedInvoices,
      stayAmountPaid,
      stayBalanceDue,
      isStaySettled,
      rs: t.common.rs,
    });
  }

  function onPrint() {
    if (!selected) return;
    try {
      printGuestReportBw(buildBwHtml(), `${selected.guestName} — guest report`);
    } catch (err) {
      toastError(
        "Print blocked",
        err instanceof Error ? err.message : "Allow pop-ups to print this report.",
      );
    }
  }

  async function onDownloadPdf() {
    if (!selected) return;
    setDownloading("pdf");
    try {
      await downloadGuestReportPdf(
        buildBwHtml(),
        `${reportFileBase()}.pdf`,
        `${selected.guestName} — guest report`,
      );
      toastSuccess("Downloaded", "Black & white guest report PDF saved.");
    } catch (err) {
      toastError(
        "Download failed",
        err instanceof Error ? err.message : "Could not create PDF.",
      );
    } finally {
      setDownloading(null);
    }
  }

  function onDownloadCsv() {
    if (!selected) return;
    setDownloading("csv");
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const base = reportFileBase();

      const stayRows = selected.stays.map((row) => ({
        section: "Stay",
        guest: selected.guestName,
        phone: selected.phone,
        cnic: selected.cnic,
        room: row.roomNumber,
        checkIn: row.checkInAt,
        checkOut: row.checkedOutAt || row.checkOutAt,
        status: row.status,
        nights: row.nights,
        roomCharges: row.roomCharges || 0,
        extras: row.extraCharges || 0,
        totalBill: row.totalBill || 0,
        paid: stayAmountPaid(row),
        balanceDue: stayBalanceDue(row),
        paymentPlan: paymentPlanLabel(row.paymentTiming),
        paymentStatus: row.paymentStatus,
        notes: row.notes || "",
      }));

      const orderRows = selectedOrders.map((o) => ({
        section: "Food order",
        guest: selected.guestName,
        phone: selected.phone,
        cnic: selected.cnic,
        room: o.roomNumber,
        checkIn: "",
        checkOut: "",
        status: o.status,
        nights: "",
        roomCharges: "",
        extras: "",
        totalBill: o.amount || 0,
        paid: o.paymentStatus === "paid" ? o.amount || 0 : 0,
        balanceDue: o.paymentStatus === "paid" ? 0 : o.amount || 0,
        paymentPlan: o.token,
        paymentStatus: o.paymentStatus,
        notes: o.items.map((i) => `${i.qty}× ${i.name}`).join("; "),
      }));

      const invoiceRows = selectedInvoices.map((inv) => ({
        section: inv.type === "restaurant" ? "Food invoice" : "Room invoice",
        guest: selected.guestName,
        phone: selected.phone,
        cnic: selected.cnic,
        room: inv.roomNumber,
        checkIn: inv.checkInAt,
        checkOut: inv.checkOutAt,
        status: invoiceListStatus(inv),
        nights: inv.nights,
        roomCharges: inv.roomCharges,
        extras: inv.extraCharges,
        totalBill: inv.totalBill,
        paid: inv.amountPaid,
        balanceDue: inv.balanceDue,
        paymentPlan: inv.number,
        paymentStatus: inv.paymentStatus,
        notes: "",
      }));

      const rows = [...stayRows, ...orderRows, ...invoiceRows];
      if (!rows.length) {
        toastError("Nothing to export", "This guest has no stays or orders yet.");
        return;
      }

      downloadCsv(
        `${base}.csv`,
        toCsv(rows, [
          { header: "Section", value: (r) => r.section },
          { header: "Guest", value: (r) => r.guest },
          { header: "Phone", value: (r) => r.phone },
          { header: "CNIC", value: (r) => r.cnic },
          { header: "Room", value: (r) => r.room },
          { header: "Check-in", value: (r) => r.checkIn },
          { header: "Check-out", value: (r) => r.checkOut },
          { header: "Status", value: (r) => r.status },
          { header: "Nights", value: (r) => r.nights },
          { header: "Room charges", value: (r) => r.roomCharges },
          { header: "Extras", value: (r) => r.extras },
          { header: "Total", value: (r) => r.totalBill },
          { header: "Paid", value: (r) => r.paid },
          { header: "Balance due", value: (r) => r.balanceDue },
          { header: "Ref / plan", value: (r) => r.paymentPlan },
          { header: "Payment", value: (r) => r.paymentStatus },
          { header: "Notes / items", value: (r) => r.notes },
        ]),
      );
      toastSuccess("Downloaded", `Guest report CSV (${stamp}).`);
    } catch (err) {
      toastError(
        "Download failed",
        err instanceof Error ? err.message : "Could not export CSV.",
      );
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.reportsTitle}
        subtitle={t.pages.reportsSub}
        actions={
          selected ? (
            <>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={onDownloadCsv}
                disabled={Boolean(downloading)}
              >
                <Download className="h-4 w-4" />
                {downloading === "csv" ? "Exporting…" : "Download CSV"}
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => void onDownloadPdf()}
                disabled={Boolean(downloading)}
              >
                <Download className="h-4 w-4" />
                {downloading === "pdf" ? "Saving…" : "Download PDF"}
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={onPrint}
                disabled={Boolean(downloading)}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_1fr]">
        {/* Search & guest list */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader title="Find guest" />
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, phone, or CNIC…"
              className="ps-9"
            />
            {query ? (
              <button
                type="button"
                className="absolute end-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted hover:text-app"
                onClick={() => setQuery("")}
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <p className="mb-2 text-xs text-muted">
            {filtered.length} guest{filtered.length === 1 ? "" : "s"}
            {query ? " match" : ""}
          </p>
          <ul className="max-h-[min(40vh,320px)] space-y-1 overflow-y-auto lg:max-h-[min(60vh,520px)]">
            {filtered.length === 0 ? (
              <li>
                <EmptyState message="No guests match this search." />
              </li>
            ) : (
              filtered.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(p.key)}
                    className={cn(
                      "w-full cursor-pointer rounded-xl border px-3 py-2.5 text-start transition-colors",
                      selectedKey === p.key
                        ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]"
                        : "border-transparent hover:bg-app",
                    )}
                  >
                    <p className="truncate text-sm font-semibold">{p.guestName}</p>
                    <p className="truncate text-xs text-muted">
                      {p.phone || "No phone"}
                      {p.cnic ? ` · ${p.cnic}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {p.stayCount} stay{p.stayCount === 1 ? "" : "s"}
                      {p.bookings.length
                        ? ` · ${p.bookings.length} booking${p.bookings.length === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>

        {/* Report dossier */}
        {!selected ? (
          <Card>
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
              <FileBarChart className="h-10 w-10 text-[var(--accent)] opacity-80" />
              <p className="text-lg font-semibold">Select a guest</p>
              <p className="max-w-sm text-sm text-muted">
                Search by name, phone, or CNIC to open a full report — personal details,
                stays, bookings, food orders, and bills.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Stays"
                value={String(selected.stayCount)}
                hint={
                  selected.stays.some((s) => s.status === "checked_in")
                    ? "Currently in house"
                    : "History only"
                }
              />
              <StatCard
                label="Room billed"
                value={formatRs(selected.totalBilled, t.common.rs)}
              />
              <StatCard
                label="Collected"
                value={formatRs(selected.totalPaid, t.common.rs)}
              />
              <StatCard
                label="Balance due"
                value={formatRs(reportOutstanding, t.common.rs)}
                hint={
                  reportOutstanding > 0
                    ? "Still owed on open stays"
                    : "All settled — no dues"
                }
              />
            </div>

            <div className="space-y-4">
              <Card>
                <h1 className="text-xl font-extrabold tracking-tight">{selected.guestName}</h1>
                <p className="muted text-sm text-muted">
                  Guest report · Tabarak Hotel & Restaurant
                </p>
                <h2 className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-muted">
                  Personal information
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Detail label={t.common.name} value={selected.guestName} />
                  <Detail label={t.common.phone} value={selected.phone} />
                  <Detail label={t.common.cnic} value={selected.cnic} />
                  <Detail label={t.common.email} value={selected.email} />
                  <Detail label={t.common.nationality} value={selected.nationality} />
                  {latestStay ? (
                    <>
                      <Detail
                        label="Adults / children"
                        value={`${latestStay.adults} / ${latestStay.children}`}
                      />
                      <Detail label="Purpose" value={latestStay.purpose} />
                      <Detail label="Vehicle color" value={latestStay.vehicleColor} />
                      <Detail label="Vehicle number" value={latestStay.vehicleNumber} />
                    </>
                  ) : null}
                </div>

                {latestStay?.companions?.length ? (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                      Companions (latest stay)
                    </p>
                    <ul className="space-y-1 text-sm">
                      {latestStay.companions.map((c, i) => (
                        <li key={i} className="rounded-lg bg-app px-3 py-2">
                          {c.name}
                          {c.relation ? ` · ${c.relation}` : ""}
                          {c.cnic ? ` · ${c.cnic}` : ""}
                          {c.phone ? ` · ${c.phone}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {latestStay &&
                (latestStay.cnicFrontImageUrl ||
                  latestStay.cnicImageUrl ||
                  latestStay.cnicBackImageUrl) ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
                    {(latestStay.cnicFrontImageUrl || latestStay.cnicImageUrl) && (
                      <a
                        href={latestStay.cnicFrontImageUrl || latestStay.cnicImageUrl || ""}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                          CNIC front
                        </p>
                        <img
                          src={latestStay.cnicFrontImageUrl || latestStay.cnicImageUrl || ""}
                          alt="CNIC front"
                          className="h-36 w-full rounded-xl border border-app object-cover"
                        />
                      </a>
                    )}
                    {latestStay.cnicBackImageUrl ? (
                      <a
                        href={latestStay.cnicBackImageUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                          CNIC back
                        </p>
                        <img
                          src={latestStay.cnicBackImageUrl}
                          alt="CNIC back"
                          className="h-36 w-full rounded-xl border border-app object-cover"
                        />
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </Card>

              <Card>
                <CardHeader title="Room bookings & stays" />
                {selected.stays.length === 0 ? (
                  <EmptyState message="No check-in stays on record for this guest." />
                ) : (
                  <div className="space-y-3">
                    {selected.stays.map((row) => {
                      const settled = isStaySettled(row);
                      const paid = stayAmountPaid(row);
                      const due = stayBalanceDue(row);
                      return (
                        <article
                          key={row.id}
                          className="rounded-2xl border border-app bg-app/60 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-extrabold tracking-tight">
                                  Room {row.roomNumber}
                                </p>
                                <Badge tone={stayStatusTone(row.status)}>
                                  {stayStatusLabel(row.status)}
                                </Badge>
                                {settled ? (
                                  <Badge tone="success">Settled</Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm text-muted">
                                {formatDateTime(row.checkInAt)}
                                <span className="mx-1.5 text-muted/60">→</span>
                                {formatDateTime(row.checkedOutAt || row.checkOutAt)}
                                <span className="mx-1.5">·</span>
                                {row.nights || 0} night
                                {(row.nights || 0) === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="text-end">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                                Stay total
                              </p>
                              <p className="text-xl font-extrabold tabular-nums">
                                {formatRs(row.totalBill || 0, t.common.rs)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-xl border border-app bg-elevated px-3 py-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                                Payment plan
                              </p>
                              <p className="mt-0.5 text-sm font-semibold">
                                {paymentPlanLabel(row.paymentTiming)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-app bg-elevated px-3 py-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                                Room / extras
                              </p>
                              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                                {formatRs(row.roomCharges || 0, t.common.rs)}
                                <span className="font-normal text-muted">
                                  {" "}
                                  + {formatRs(row.extraCharges || 0, t.common.rs)}
                                </span>
                              </p>
                            </div>
                            <div className="rounded-xl border border-app bg-elevated px-3 py-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                                Paid
                              </p>
                              <p
                                className={cn(
                                  "mt-0.5 text-sm font-semibold tabular-nums",
                                  paid > 0 ? "text-emerald-700" : "text-muted",
                                )}
                              >
                                {formatRs(paid, t.common.rs)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-app bg-elevated px-3 py-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                                Balance due
                              </p>
                              <p
                                className={cn(
                                  "mt-0.5 text-sm font-semibold tabular-nums",
                                  due > 0 ? "text-red-700" : "text-muted",
                                )}
                              >
                                {formatRs(due, t.common.rs)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            <span>
                              Rate:{" "}
                              <strong className="text-app">
                                {formatRs(row.nightlyRate || 0, t.common.rs)}
                              </strong>
                              /night
                            </span>
                            <span>
                              Checked in by:{" "}
                              <strong className="text-app">
                                {row.checkedInBy || "—"}
                              </strong>
                            </span>
                            {row.status === "checked_out" ? (
                              <span>
                                Checked out by:{" "}
                                <strong className="text-app">
                                  {row.checkedOutBy || "—"}
                                </strong>
                              </span>
                            ) : null}
                          </div>

                          {row.notes ? (
                            <p className="mt-3 rounded-xl border border-dashed border-app px-3 py-2 text-sm text-muted">
                              {row.notes}
                            </p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </Card>

              {selected.bookings.length > 0 ? (
                <Card>
                  <CardHeader title="Booking requests" />
                  <Table
                    headers={[
                      t.common.room,
                      t.common.checkIn,
                      t.common.checkOut,
                      t.status,
                      "Channel",
                      "Booked by",
                      "Reference",
                      t.common.amount,
                    ]}
                  >
                    {selected.bookings.map((b) => (
                      <Tr key={b.id}>
                        <Td className="font-semibold">
                          {b.roomNumber || b.roomType || "—"}
                        </Td>
                        <Td className="text-xs">{formatDate(b.checkInAt)}</Td>
                        <Td className="text-xs">{formatDate(b.checkOutAt)}</Td>
                        <Td>
                          <Badge tone="info">{b.status}</Badge>
                        </Td>
                        <Td className="text-muted">{b.channel}</Td>
                        <Td className="text-muted">{b.bookedBy || "—"}</Td>
                        <Td className="text-muted">{b.reference || "—"}</Td>
                        <Td className="tabular-nums">
                          {formatRs(b.totalBill || 0, t.common.rs)}
                        </Td>
                      </Tr>
                    ))}
                  </Table>
                </Card>
              ) : null}

              <Card>
                <CardHeader title="Food orders" />
                {selectedOrders.length === 0 ? (
                  <EmptyState message="No food orders linked to this guest’s stays." />
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap gap-3 text-sm">
                      <span className="text-muted">
                        Total:{" "}
                        <strong className="text-app">
                          {formatRs(foodTotals.billed, t.common.rs)}
                        </strong>
                      </span>
                      <span className="text-muted">
                        Paid:{" "}
                        <strong className="text-emerald-700">
                          {formatRs(foodTotals.paid, t.common.rs)}
                        </strong>
                      </span>
                      <span className="text-muted">
                        Due:{" "}
                        <strong className="text-red-700">
                          {formatRs(foodTotals.due, t.common.rs)}
                        </strong>
                      </span>
                    </div>
                    <Table
                      headers={[
                        "Token",
                        t.common.room,
                        t.items,
                        t.common.amount,
                        t.status,
                        "Payment",
                      ]}
                    >
                      {selectedOrders.map((o) => (
                        <Tr key={o.id}>
                          <Td className="font-mono text-xs font-bold">{o.token}</Td>
                          <Td>{o.roomNumber}</Td>
                          <Td className="text-xs text-muted">
                            {o.items
                              .map((i) => `${i.qty}× ${i.name}`)
                              .join(", ")}
                          </Td>
                          <Td className="tabular-nums font-medium">
                            {formatRs(o.amount, t.common.rs)}
                          </Td>
                          <Td>
                            <Badge tone={o.status === "delivered" ? "success" : "warning"}>
                              {o.status}
                            </Badge>
                          </Td>
                          <Td>
                            <Badge
                              tone={o.paymentStatus === "paid" ? "success" : "danger"}
                            >
                              {o.paymentStatus === "paid" ? "Paid" : "Due"}
                            </Badge>
                          </Td>
                        </Tr>
                      ))}
                    </Table>
                  </>
                )}
              </Card>

              <Card>
                <CardHeader title="Bills / invoices" />
                {selectedInvoices.length === 0 ? (
                  <EmptyState message="No invoices for this guest yet." />
                ) : (
                  <Table
                    headers={[
                      "Invoice",
                      t.common.type,
                      t.common.room,
                      t.common.date,
                      t.common.amount,
                      t.common.paid,
                      "Due",
                      t.status,
                    ]}
                  >
                    {selectedInvoices.map((inv) => {
                      const status = invoiceListStatus(inv);
                      return (
                        <Tr key={inv.id}>
                          <Td className="font-mono text-xs font-bold">{inv.number}</Td>
                          <Td>
                            <Badge tone={inv.type === "restaurant" ? "info" : "gold"}>
                              {inv.type === "restaurant" ? "Food" : "Room"}
                            </Badge>
                          </Td>
                          <Td>{inv.roomNumber}</Td>
                          <Td className="text-xs">{formatDate(inv.checkInAt)}</Td>
                          <Td className="tabular-nums font-medium">
                            {formatRs(inv.totalBill, t.common.rs)}
                          </Td>
                          <Td className="tabular-nums text-emerald-700">
                            {formatRs(inv.amountPaid, t.common.rs)}
                          </Td>
                          <Td className="tabular-nums text-red-700">
                            {formatRs(inv.balanceDue, t.common.rs)}
                          </Td>
                          <Td>
                            <Badge
                              tone={
                                status === "paid"
                                  ? "success"
                                  : status === "partial"
                                    ? "warning"
                                    : "danger"
                              }
                            >
                              {paymentStatusLabel(status === "unpaid" ? "due" : status)}
                            </Badge>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Table>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
