import { forwardRef, type CSSProperties } from "react";
import type { GuestInvoice } from "../../types/invoice";
import { invoiceListStatus } from "../../types/invoice";
import { paymentPlanLabel, paymentStatusLabel } from "../../lib/paymentDisplay";
import { formatRs } from "../../lib/utils";

const GOLD = "#b8860b";
const INK = "#141414";
const MUTED = "#6b6b6b";
const LINE = "#e8e4dc";
const PAPER = "#fffcf7";
const HEADER_BG = "#111111";

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
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
    status === "paid" ? "PAID" : status === "partial" ? "PARTIAL" : "DUE";
  const statusColor =
    status === "paid" ? "#1a7f4b" : status === "partial" ? "#b8860b" : "#c0392b";

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
        fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
        boxShadow: "0 24px 64px rgba(0,0,0,0.14)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: HEADER_BG,
          color: "#fff",
          padding: "28px 36px 24px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            background: GOLD,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: GOLD,
                fontWeight: 700,
              }}
            >
              {isFood ? "Restaurant invoice" : "Room invoice"}
            </p>
            <h1
              style={{
                margin: "8px 0 0",
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              {hotelName}
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b0b0b0" }}>
              {isFood
                ? "Hotel & Restaurant · Food / room service bill"
                : "Hotel & Restaurant · Accommodation folio"}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#888",
              }}
            >
              Invoice
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 16,
                fontWeight: 800,
                color: GOLD,
                fontFamily: "ui-monospace, Consolas, monospace",
              }}
            >
              {invoice.number}
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#aaa" }}>
              Issued {fmtDate(invoice.issuedAt)}
            </p>
            <span
              style={{
                display: "inline-block",
                marginTop: 12,
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.14em",
                background: statusColor,
                color: "#fff",
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: 3, background: `linear-gradient(90deg, ${GOLD}, #f0d78c, ${GOLD})` }} />

      <div style={{ padding: "28px 36px 36px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 28,
            marginBottom: 28,
          }}
        >
          <div>
            <p style={sectionLabel}>Bill to</p>
            <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 800 }}>{invoice.guestName}</p>
            {invoice.phone ? (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: MUTED }}>{invoice.phone}</p>
            ) : null}
            {invoice.email ? (
              <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>{invoice.email}</p>
            ) : null}
            {invoice.cnic ? (
              <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>CNIC {invoice.cnic}</p>
            ) : null}
            {invoice.nationality ? (
              <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>{invoice.nationality}</p>
            ) : null}
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={sectionLabel}>{isFood ? "Service to" : "Stay details"}</p>
            <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 800 }}>
              Room {invoice.roomNumber}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: MUTED }}>
              Check-in · {fmtDate(invoice.checkInAt)}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>
              Check-out · {fmtDate(invoice.checkOutAt)}
            </p>
            {!isFood ? (
              <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>
                {invoice.nights} night{invoice.nights === 1 ? "" : "s"} · {invoice.adults} adult
                {invoice.adults === 1 ? "" : "s"}
                {invoice.children > 0 ? ` · ${invoice.children} child(ren)` : ""}
              </p>
            ) : (
              <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>
                Room service / restaurant charges for this stay
              </p>
            )}
            <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>
              {invoice.stayStatus === "checked_in" ? "In house" : "Checked out"}
            </p>
          </div>
        </div>

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
              <th style={thRight}>Rate</th>
              <th style={thRight}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {!isFood ? (
              <>
                <tr>
                  <td colSpan={4} style={groupHeader}>
                    Accommodation
                  </td>
                </tr>
                <tr>
                  <td style={tdLeft}>
                    Room {invoice.roomNumber} — {invoice.nights} night
                    {invoice.nights === 1 ? "" : "s"}
                  </td>
                  <td style={tdCenter}>{invoice.nights}</td>
                  <td style={tdRight}>{fmtMoney(invoice.nightlyRate, rs)}</td>
                  <td style={{ ...tdRight, fontWeight: 700 }}>
                    {fmtMoney(invoice.roomCharges, rs)}
                  </td>
                </tr>
                {invoice.otherExtras > 0 ? (
                  <>
                    <tr>
                      <td colSpan={4} style={groupHeader}>
                        Other charges
                      </td>
                    </tr>
                    <tr>
                      <td style={tdLeft}>Extras / miscellaneous</td>
                      <td style={tdCenter}>1</td>
                      <td style={tdRight}>{fmtMoney(invoice.otherExtras, rs)}</td>
                      <td style={{ ...tdRight, fontWeight: 700 }}>
                        {fmtMoney(invoice.otherExtras, rs)}
                      </td>
                    </tr>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <tr>
                  <td colSpan={4} style={groupHeader}>
                    Food &amp; beverages
                  </td>
                </tr>
                {invoice.foodLines.map((line, i) => (
                  <tr key={`${line.orderToken}-${i}`}>
                    <td style={tdLeft}>
                      {line.name}
                      <span style={{ color: MUTED, fontSize: 11, marginLeft: 8 }}>
                        {line.orderToken}
                        {" · "}
                        {line.paymentStatus === "paid" ? "Paid" : "Due"}
                      </span>
                    </td>
                    <td style={tdCenter}>{line.qty}</td>
                    <td style={tdRight}>{fmtMoney(line.unitPrice, rs)}</td>
                    <td style={{ ...tdRight, fontWeight: 700 }}>{fmtMoney(line.amount, rs)}</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              width: 300,
              border: `1px solid ${LINE}`,
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            {!isFood ? (
              <>
                <div style={totalRow}>
                  <span style={{ color: MUTED }}>Room</span>
                  <span>{fmtMoney(invoice.roomCharges, rs)}</span>
                </div>
                {invoice.otherExtras > 0 ? (
                  <div style={totalRow}>
                    <span style={{ color: MUTED }}>Other</span>
                    <span>{fmtMoney(invoice.otherExtras, rs)}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div style={totalRow}>
                <span style={{ color: MUTED }}>Food</span>
                <span>{fmtMoney(invoice.foodTotal, rs)}</span>
              </div>
            )}
            <div
              style={{
                ...totalRow,
                background: HEADER_BG,
                color: "#fff",
                fontWeight: 800,
                fontSize: 16,
                borderBottom: "none",
              }}
            >
              <span style={{ color: GOLD }}>Total</span>
              <span>{fmtMoney(invoice.totalBill, rs)}</span>
            </div>
            <div style={totalRow}>
              <span style={{ color: MUTED }}>Paid</span>
              <span style={{ color: "#1a7f4b", fontWeight: 700 }}>
                {fmtMoney(invoice.amountPaid, rs)}
              </span>
            </div>
            <div style={{ ...totalRow, borderBottom: "none" }}>
              <span style={{ color: MUTED }}>Balance due</span>
              <span
                style={{
                  fontWeight: 800,
                  color: invoice.balanceDue > 0 ? "#c0392b" : "#1a7f4b",
                }}
              >
                {fmtMoney(invoice.balanceDue, rs)}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            fontSize: 12,
            color: MUTED,
          }}
        >
          <span>
            Payment:{" "}
            <strong style={{ color: INK }}>{paymentStatusLabel(invoice.paymentStatus)}</strong>
          </span>
          <span>·</span>
          <span>
            Plan: <strong style={{ color: INK }}>{paymentPlanLabel(invoice.paymentTiming)}</strong>
          </span>
          <span>·</span>
          <span>
            Invoice type:{" "}
            <strong style={{ color: INK }}>{isFood ? "Restaurant / food" : "Room stay"}</strong>
          </span>
        </div>

        {invoice.notes && !isFood ? (
          <p
            style={{
              marginTop: 20,
              padding: "12px 14px",
              background: "#f5f1ea",
              borderRadius: 10,
              fontSize: 12,
              color: MUTED,
            }}
          >
            <strong style={{ color: INK }}>Notes:</strong> {invoice.notes}
          </p>
        ) : null}

        <div
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: `1px dashed ${LINE}`,
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: GOLD,
              letterSpacing: "0.04em",
            }}
          >
            {isFood ? "Thank you for dining with us" : "Thank you for staying with us"}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: MUTED }}>
            {hotelName} ·{" "}
            {isFood
              ? "Computer-generated restaurant invoice (separate from room folio)."
              : "Computer-generated room invoice (separate from food bills)."}
          </p>
        </div>
      </div>
    </div>
  );
});

const sectionLabel: CSSProperties = {
  margin: 0,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: GOLD,
};

const thLeft: CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: `2px solid ${INK}`,
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: MUTED,
};
const thCenter: CSSProperties = { ...thLeft, textAlign: "center" };
const thRight: CSSProperties = { ...thLeft, textAlign: "right" };

const groupHeader: CSSProperties = {
  padding: "14px 8px 6px",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: GOLD,
  background: "transparent",
};

const tdLeft: CSSProperties = {
  padding: "10px 8px",
  borderBottom: `1px solid ${LINE}`,
  verticalAlign: "top",
};
const tdCenter: CSSProperties = { ...tdLeft, textAlign: "center" };
const tdRight: CSSProperties = { ...tdLeft, textAlign: "right" };

const totalRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 16px",
  borderBottom: `1px solid ${LINE}`,
  fontSize: 13,
};
