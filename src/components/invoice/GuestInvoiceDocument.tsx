import { forwardRef, type CSSProperties } from "react";
import type { GuestInvoice } from "../../types/invoice";
import { invoiceListStatus } from "../../types/invoice";
import { paymentPlanLabel, paymentStatusLabel } from "../../lib/paymentDisplay";
import { formatRs } from "../../lib/utils";

/** Ink-friendly palette — white paper, black text, thin gray rules only. */
const INK = "#1a1a1a";
const MUTED = "#555555";
const LINE = "#cccccc";
const RULE = "#1a1a1a";
const PAPER = "#ffffff";

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtMoney(n: number, rs: string) {
  return formatRs(n, rs);
}

export const GuestInvoiceDocument = forwardRef<
  HTMLDivElement,
  { invoice: GuestInvoice; hotelName: string; rs?: string }
>(function GuestInvoiceDocument({ invoice, hotelName, rs = "Rs" }, ref) {
  const isFood = invoice.type === "restaurant";
  const status = invoiceListStatus(invoice);
  const statusLabel =
    status === "paid" ? "Paid" : status === "partial" ? "Partial" : "Due";

  return (
    <div
      ref={ref}
      className="invoice-sheet"
      style={{
        width: "800px",
        maxWidth: "100%",
        margin: "0 auto",
        background: PAPER,
        color: INK,
        fontFamily: "Arial, Helvetica, sans-serif",
        border: `1px solid ${RULE}`,
        boxSizing: "border-box",
      }}
    >
      <div style={{ padding: "32px 36px 28px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            marginBottom: 28,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={eyebrow}>
              {isFood ? "Restaurant invoice" : "Room invoice"}
            </p>
            <h1
              style={{
                margin: "4px 0 0",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: INK,
                lineHeight: 1.15,
              }}
            >
              {hotelName}
            </h1>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
              Tabarak Hotel &amp; Restaurant
              <br />
              {isFood
                ? "Food / room service bill (separate from room folio)"
                : "Accommodation folio (separate from food bills)"}
            </p>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div
              style={{
                display: "inline-block",
                border: `1px solid ${RULE}`,
                padding: "10px 14px",
                textAlign: "left",
                background: PAPER,
                minWidth: 160,
              }}
            >
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: INK }}>
                NO. {invoice.number}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED }}>
                Issued {fmtDate(invoice.issuedAt)}
              </p>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: MUTED }}>
              Status: <strong style={{ color: INK }}>{statusLabel}</strong>
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>
              Stay:{" "}
              <strong style={{ color: INK }}>
                {invoice.stayStatus === "checked_in" ? "In house" : "Checked out"}
              </strong>
            </p>
          </div>
        </div>

        {/* Bill to / Stay */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 24,
            marginBottom: 20,
          }}
        >
          <div>
            <p style={sectionLabel}>Bill to</p>
            <p style={partyName}>{invoice.guestName}</p>
            {invoice.phone ? <p style={partyLine}>{invoice.phone}</p> : null}
            {invoice.email ? <p style={partyLine}>{invoice.email}</p> : null}
            {invoice.cnic ? <p style={partyLine}>CNIC {invoice.cnic}</p> : null}
            {invoice.nationality ? (
              <p style={partyLine}>{invoice.nationality}</p>
            ) : null}
          </div>
          <div>
            <p style={sectionLabel}>{isFood ? "Service to" : "Stay details"}</p>
            <p style={partyName}>Room {invoice.roomNumber}</p>
            <p style={partyLine}>Check-in · {fmtDateTime(invoice.checkInAt)}</p>
            <p style={partyLine}>Check-out · {fmtDateTime(invoice.checkOutAt)}</p>
            {!isFood ? (
              <p style={partyLine}>
                {invoice.nights} night{invoice.nights === 1 ? "" : "s"} · {invoice.adults}{" "}
                adult{invoice.adults === 1 ? "" : "s"}
                {invoice.children > 0 ? ` · ${invoice.children} child(ren)` : ""}
              </p>
            ) : (
              <p style={partyLine}>Room service / restaurant charges for this stay</p>
            )}
          </div>
        </div>

        <p
          style={{
            margin: "0 0 14px",
            fontSize: 11,
            fontStyle: "italic",
            color: MUTED,
            textAlign: "right",
          }}
        >
          Payment: {paymentStatusLabel(invoice.paymentStatus)} · Plan:{" "}
          {paymentPlanLabel(invoice.paymentTiming)}
        </p>

        {/* Line items */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              <th style={thLeft}>Description</th>
              <th style={thCenter}>Qty</th>
              <th style={thRight}>Price</th>
              <th style={thRight}>Total</th>
            </tr>
          </thead>
          <tbody>
            {!isFood ? (
              <>
                <tr>
                  <td style={tdLeft}>
                    Room {invoice.roomNumber} — accommodation
                    <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {invoice.nights} night{invoice.nights === 1 ? "" : "s"} @{" "}
                      {fmtMoney(invoice.nightlyRate, rs)}
                    </span>
                  </td>
                  <td style={tdCenter}>{invoice.nights}</td>
                  <td style={tdRight}>{fmtMoney(invoice.nightlyRate, rs)}</td>
                  <td style={{ ...tdRight, fontWeight: 700 }}>
                    {fmtMoney(invoice.roomCharges, rs)}
                  </td>
                </tr>
                {invoice.otherExtras > 0 ? (
                  <tr>
                    <td style={tdLeft}>Extras / miscellaneous</td>
                    <td style={tdCenter}>1</td>
                    <td style={tdRight}>{fmtMoney(invoice.otherExtras, rs)}</td>
                    <td style={{ ...tdRight, fontWeight: 700 }}>
                      {fmtMoney(invoice.otherExtras, rs)}
                    </td>
                  </tr>
                ) : null}
              </>
            ) : (
              invoice.foodLines.map((line, i) => (
                <tr key={`${line.orderToken}-${i}`}>
                  <td style={tdLeft}>
                    {line.name}
                    <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {line.orderToken} · {line.paymentStatus === "paid" ? "Paid" : "Due"}
                    </span>
                  </td>
                  <td style={tdCenter}>{line.qty}</td>
                  <td style={tdRight}>{fmtMoney(line.unitPrice, rs)}</td>
                  <td style={{ ...tdRight, fontWeight: 700 }}>{fmtMoney(line.amount, rs)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "flex-end",
            borderTop: `1px solid ${RULE}`,
            paddingTop: 12,
          }}
        >
          <div style={{ width: 280 }}>
            {!isFood ? (
              <>
                <div style={totalRow}>
                  <span style={{ color: MUTED }}>Subtotal (room)</span>
                  <span>{fmtMoney(invoice.roomCharges, rs)}</span>
                </div>
                {invoice.otherExtras > 0 ? (
                  <div style={totalRow}>
                    <span style={{ color: MUTED }}>Extras</span>
                    <span>{fmtMoney(invoice.otherExtras, rs)}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div style={totalRow}>
                <span style={{ color: MUTED }}>Subtotal (food)</span>
                <span>{fmtMoney(invoice.foodTotal, rs)}</span>
              </div>
            )}
            <div style={{ ...totalRow, fontWeight: 700 }}>
              <span>Total amount</span>
              <span>{fmtMoney(invoice.totalBill, rs)}</span>
            </div>
            <div style={totalRow}>
              <span style={{ color: MUTED }}>Amount paid</span>
              <span>{fmtMoney(invoice.amountPaid, rs)}</span>
            </div>
            <div
              style={{
                ...totalRow,
                marginTop: 6,
                paddingTop: 10,
                borderTop: `2px solid ${RULE}`,
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              <span>Balance due</span>
              <span>{fmtMoney(invoice.balanceDue, rs)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 36,
            paddingTop: 16,
            borderTop: `1px solid ${LINE}`,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 24,
          }}
        >
          <div>
            <p style={footerTitle}>Terms &amp; conditions</p>
            <p style={footerBody}>
              {isFood
                ? "This is a computer-generated restaurant invoice. Food charges are billed separately from the room folio."
                : "This is a computer-generated room invoice. Accommodation is billed separately from restaurant / room-service invoices."}
              {invoice.notes && !isFood ? ` Notes: ${invoice.notes}` : ""}
            </p>
          </div>
          <div>
            <p style={footerTitle}>Payment information</p>
            <p style={footerBody}>
              Please settle any balance due before or at check-out.
              <br />
              Status: {statusLabel} · {paymentPlanLabel(invoice.paymentTiming)}
            </p>
          </div>
        </div>

        <p
          style={{
            margin: "28px 0 0",
            textAlign: "center",
            fontSize: 11,
            color: MUTED,
          }}
        >
          {isFood ? "Thank you for dining with us" : "Thank you for staying with us"} ·{" "}
          {hotelName}
        </p>
      </div>
    </div>
  );
});

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: MUTED,
  fontWeight: 600,
};

const sectionLabel: CSSProperties = {
  margin: 0,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: MUTED,
};

const partyName: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 16,
  fontWeight: 700,
  color: INK,
};

const partyLine: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 12,
  color: MUTED,
  lineHeight: 1.45,
};

const thLeft: CSSProperties = {
  textAlign: "left",
  padding: "10px 6px",
  borderBottom: `1px solid ${RULE}`,
  borderTop: `1px solid ${RULE}`,
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: MUTED,
  fontWeight: 700,
  background: PAPER,
};
const thCenter: CSSProperties = { ...thLeft, textAlign: "center" };
const thRight: CSSProperties = { ...thLeft, textAlign: "right" };

const tdLeft: CSSProperties = {
  padding: "12px 6px",
  borderBottom: `1px solid ${LINE}`,
  verticalAlign: "top",
  color: INK,
  background: PAPER,
};
const tdCenter: CSSProperties = { ...tdLeft, textAlign: "center" };
const tdRight: CSSProperties = { ...tdLeft, textAlign: "right" };

const totalRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "5px 0",
  fontSize: 13,
  color: INK,
  background: PAPER,
};

const footerTitle: CSSProperties = {
  margin: 0,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: INK,
};

const footerBody: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 11,
  color: MUTED,
  lineHeight: 1.5,
};
