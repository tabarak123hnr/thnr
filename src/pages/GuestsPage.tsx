import { Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { calcRoomBill } from "../lib/billing";
import {
  isBillFullyPaid,
  paymentBadge,
  paymentPlanLabel,
  paymentSplitLine,
  resolveAmountPaid,
  resolveBalanceDue,
} from "../lib/paymentDisplay";
import { formatRs } from "../lib/utils";
import { subscribeCheckIns, type CheckInRecord } from "../services/checkIns";
import { subscribeRooms, type HotelRoom } from "../services/rooms";

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

function resolveBill(row: CheckInRecord, rooms: HotelRoom[]) {
  if (row.totalBill > 0 && row.nightlyRate > 0) {
    return {
      nights: row.nights,
      nightlyRate: row.nightlyRate,
      totalBill: row.totalBill,
      roomCharges: row.roomCharges,
    };
  }
  const rate = row.nightlyRate || rooms.find((r) => r.id === row.roomId)?.rate || 0;
  return calcRoomBill(rate, row.checkInAt, row.checkOutAt, row.extraCharges || 0);
}

export function GuestsPage() {
  const { t } = useApp();
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [filter, setFilter] = useState<"all" | "checked_in" | "checked_out">("all");
  const [viewRow, setViewRow] = useState<CheckInRecord | null>(null);

  useEffect(() => {
    const a = subscribeCheckIns(setCheckIns);
    const b = subscribeRooms(setRooms);
    return () => {
      a();
      b();
    };
  }, []);

  const rows = useMemo(() => {
    const list =
      filter === "all"
        ? checkIns.filter((c) => c.status !== "cancelled")
        : checkIns.filter((c) => c.status === filter);
    return list.map((row) => ({ row, bill: resolveBill(row, rooms) }));
  }, [checkIns, rooms, filter]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, { bill, row }) => {
        const paid = resolveAmountPaid({ ...row, totalBill: bill.totalBill });
        const due = resolveBalanceDue({ ...row, totalBill: bill.totalBill });
        if (isBillFullyPaid({ ...row, totalBill: bill.totalBill })) {
          acc.billsPaid += bill.totalBill;
        } else {
          acc.dueBills += due > 0 ? due : bill.totalBill - paid;
        }
        return acc;
      },
      { dueBills: 0, billsPaid: 0 },
    );
  }, [rows]);

  const viewBill = viewRow ? resolveBill(viewRow, rooms) : null;

  return (
    <div>
      <PageHeader
        title={t.pages.guestsTitle}
        subtitle={t.pages.guestsSub}
        actions={
          <div className="w-40 shrink-0">
            <FancySelect
              value={filter}
              onChange={(v) => setFilter(v as typeof filter)}
              options={[
                { value: "all", label: "All stays" },
                { value: "checked_in", label: "In house" },
                { value: "checked_out", label: "Checked out" },
              ]}
            />
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="!p-4">
          <p className="text-sm text-muted">Due bills</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--accent)]">
            {formatRs(totals.dueBills, t.common.rs)}
          </p>
          <p className="mt-1 text-xs text-muted">Outstanding balance (unpaid + partial)</p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-muted">Bills paid</p>
          <p className="mt-1 text-2xl font-extrabold">{formatRs(totals.billsPaid, t.common.rs)}</p>
          <p className="mt-1 text-xs text-muted">Fully settled stays</p>
        </Card>
      </div>

      <Card>
        <Table
          headers={[
            t.common.guest,
            t.common.room,
            "Stay",
            "Nights",
            "Bill",
            "Payment",
            t.status,
            t.common.actions,
          ]}
          colWidths={["15%", "8%", "20%", "8%", "12%", "18%", "10%", "9%"]}
        >
          {rows.length === 0 ? (
            <Tr>
              <Td className="text-muted" colSpan={8}>
                No guests yet. Stays appear here after check-in.
              </Td>
            </Tr>
          ) : (
            rows.map(({ row, bill }) => {
              const badge = paymentBadge(row);
              const paid = resolveAmountPaid({ ...row, totalBill: bill.totalBill });
              const due = resolveBalanceDue({ ...row, totalBill: bill.totalBill });
              return (
                <Tr key={row.id}>
                  <Td>
                    <p className="font-semibold">{row.guestName}</p>
                    <p className="text-xs text-muted">{row.phone}</p>
                  </Td>
                  <Td className="font-semibold">{row.roomNumber}</Td>
                  <Td className="text-xs">
                    <div>{formatDateTime(row.checkInAt)}</div>
                    <div className="text-muted">→ {formatDateTime(row.checkOutAt)}</div>
                  </Td>
                  <Td className="font-semibold">{bill.nights}</Td>
                  <Td className="font-extrabold text-[var(--accent)]">
                    {formatRs(bill.totalBill, t.common.rs)}
                  </Td>
                  <Td>
                    <div className="space-y-1">
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                      {(row.paymentStatus === "partial" || (paid > 0 && due > 0)) && (
                        <p className="text-[11px] text-muted">
                          {paymentSplitLine({ ...row, totalBill: bill.totalBill }, t.common.rs)}
                        </p>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={row.status === "checked_in" ? "success" : "muted"}>
                      {row.status === "checked_in" ? "In house" : "Checked out"}
                    </Badge>
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500 hover:!shadow-md"
                      icon={<Eye className="h-3.5 w-3.5" />}
                      onClick={() => setViewRow(row)}
                    >
                      View
                    </Button>
                  </Td>
                </Tr>
              );
            })
          )}
        </Table>
      </Card>

      <Modal
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title="Guest details"
        subtitle={viewRow ? `Room ${viewRow.roomNumber}` : undefined}
        wide
        footer={
          <Button type="button" variant="secondary" onClick={() => setViewRow(null)}>
            Close
          </Button>
        }
      >
        {viewRow && viewBill ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label={t.common.name} value={viewRow.guestName} />
              <Detail label={t.common.phone} value={viewRow.phone} />
              <Detail label={t.common.email} value={viewRow.email || "—"} />
              <Detail label={t.common.cnic} value={viewRow.cnic || "—"} />
              <Detail label={t.common.nationality} value={viewRow.nationality || "—"} />
              <Detail label={t.common.room} value={viewRow.roomNumber} />
              <Detail
                label={t.status}
                value={viewRow.status === "checked_in" ? "In house" : "Checked out"}
              />
              <Detail label={t.common.checkIn} value={formatDateTime(viewRow.checkInAt)} />
              <Detail label={t.common.checkOut} value={formatDateTime(viewRow.checkOutAt)} />
              <Detail
                label="Guests"
                value={`${viewRow.adults} adults · ${viewRow.children} children`}
              />
              <Detail label="Purpose" value={viewRow.purpose || "—"} />
              <Detail label="Nights" value={String(viewBill.nights)} />
              <Detail label={t.common.rate} value={formatRs(viewBill.nightlyRate, t.common.rs)} />
              <Detail label="Payment" value={paymentBadge(viewRow).label} />
              <Detail label="Payment plan" value={paymentPlanLabel(viewRow.paymentTiming)} />
              <Detail
                label="Paid so far"
                value={formatRs(
                  resolveAmountPaid({ ...viewRow, totalBill: viewBill.totalBill }),
                  t.common.rs,
                )}
              />
              <Detail
                label="Balance due"
                value={formatRs(
                  resolveBalanceDue({ ...viewRow, totalBill: viewBill.totalBill }),
                  t.common.rs,
                )}
              />
            </div>
            <div className="rounded-2xl border border-app bg-accent-soft px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
                Stay total
              </p>
              <p className="mt-1 text-xl font-extrabold text-[var(--accent)]">
                {formatRs(viewBill.totalBill, t.common.rs)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {paymentSplitLine({ ...viewRow, totalBill: viewBill.totalBill }, t.common.rs)}
              </p>
            </div>
            {viewRow.companions.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Companions
                </p>
                <ul className="space-y-1 text-sm">
                  {viewRow.companions.map((c, i) => (
                    <li key={i} className="rounded-lg bg-app px-3 py-2">
                      {c.name}
                      {c.relation ? ` · ${c.relation}` : ""}
                      {c.cnic ? ` · ${c.cnic}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {viewRow.notes ? (
              <p className="rounded-xl bg-app px-3 py-2 text-sm text-muted">{viewRow.notes}</p>
            ) : null}
            {(viewRow.cnicFrontImageUrl || viewRow.cnicImageUrl || viewRow.cnicBackImageUrl) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(viewRow.cnicFrontImageUrl || viewRow.cnicImageUrl) ? (
                  <a
                    href={viewRow.cnicFrontImageUrl || viewRow.cnicImageUrl || ""}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block"
                  >
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                      CNIC front
                    </p>
                    <img
                      src={viewRow.cnicFrontImageUrl || viewRow.cnicImageUrl || ""}
                      alt="CNIC front"
                      className="h-36 w-full rounded-xl border border-app object-cover"
                    />
                  </a>
                ) : null}
                {viewRow.cnicBackImageUrl ? (
                  <a
                    href={viewRow.cnicBackImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block"
                  >
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                      CNIC back
                    </p>
                    <img
                      src={viewRow.cnicBackImageUrl}
                      alt="CNIC back"
                      className="h-36 w-full rounded-xl border border-app object-cover"
                    />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-app px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-semibold break-all">{value}</p>
    </div>
  );
}
