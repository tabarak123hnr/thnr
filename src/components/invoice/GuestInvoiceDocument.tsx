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
  const isMisc = invoice.type === "miscellaneous";
  const isOverall = invoice.type === "overall";
  const showRoom = invoice.type === "room" || isOverall;
  const showFood = isFood || isOverall;
  const showMisc = isMisc || isOverall;
  const status = invoiceListStatus(invoice);
  const statusLabel =
    status === "paid" ? "Paid" : status === "partial" ? "Partial" : "Due";
  const roomGstPending =
    isOverall && invoice.paymentTiming === "due_on_checkout" && invoice.roomTaxAmount <= 0;

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
              {isOverall
                ? "Overall invoice"
                : isFood
                  ? "Restaurant invoice"
                  : isMisc
                    ? "Miscellaneous invoice"
                    : "Room invoice"}
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
              {isOverall
                ? "Combined room, food, and miscellaneous bill for this stay"
                : isFood
                  ? "Food / room service bill (separate from room folio)"
                  : isMisc
                    ? "Miscellaneous bill (laundry, bedsheet, etc. - exempt from GST)"
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
            {invoice.paymentMethod ? (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>
                Payment: <strong style={{ color: INK }}>{invoice.paymentMethod}</strong>
              </p>
            ) : null}
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
            <p style={sectionLabel}>{isFood ? "Service to" : isMisc ? "Charged to" : "Stay details"}</p>
            <p style={partyName}>Room {invoice.roomNumber}</p>
            <p style={partyLine}>Check-in · {fmtDateTime(invoice.checkInAt)}</p>
            <p style={partyLine}>Check-out · {fmtDateTime(invoice.checkOutAt)}</p>
            {!isFood && !isMisc ? (
              <p style={partyLine}>
                {invoice.nights} night{invoice.nights === 1 ? "" : "s"} · {invoice.adults}{" "}
                adult{invoice.adults === 1 ? "" : "s"}
                {invoice.children > 0 ? ` · ${invoice.children} child(ren)` : ""}
              </p>
            ) : isMisc ? (
              <p style={partyLine}>Miscellaneous charges for this stay (exempt from GST)</p>
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

        {/* Summary items calculation */}
        {(() => {
          const summaryRows: { label: string; value: string }[] = [];

          if (isFood) {
            summaryRows.push({
              label: "Total",
              value: fmtMoney(invoice.foodTotal, rs),
            });
            if (invoice.foodServiceCharge && invoice.foodServiceCharge > 0) {
              summaryRows.push({
                label: "Service",
                value: fmtMoney(invoice.foodServiceCharge, rs),
              });
            }
            if (invoice.foodTaxAmount > 0 || invoice.taxAmount > 0) {
              const taxAmt = invoice.foodTaxAmount || invoice.taxAmount;
              summaryRows.push({
                label: invoice.taxPercent > 0 ? `GST (${invoice.taxPercent}%)` : (invoice.taxLabel || "GST"),
                value: fmtMoney(taxAmt, rs),
              });
            }
          } else if (isMisc) {
            summaryRows.push({
              label: "Total",
              value: fmtMoney(invoice.miscTotal || invoice.totalBill, rs),
            });
            summaryRows.push({
              label: "GST",
              value: "0% (Exempt)",
            });
          } else if (invoice.type === "room") {
            const roomSubtotal = (invoice.roomChargesBefore || invoice.roomCharges) + invoice.otherExtras;
            summaryRows.push({
              label: "Total",
              value: fmtMoney(roomSubtotal, rs),
            });
            if (invoice.discountAmount > 0) {
              summaryRows.push({
                label: invoice.discountPercent > 0 ? `Discount (${invoice.discountPercent}%)` : "Discount",
                value: `−${fmtMoney(invoice.discountAmount, rs)}`,
              });
            }
            if (invoice.taxAmount > 0) {
              summaryRows.push({
                label: invoice.taxPercent > 0 ? `GST (${invoice.taxPercent}%)` : (invoice.taxLabel || "GST"),
                value: fmtMoney(invoice.taxAmount, rs),
              });
            }
          } else {
            // Overall invoice
            const overallSubtotal =
              (invoice.roomChargesBefore || invoice.roomCharges) +
              invoice.otherExtras +
              invoice.foodTotal +
              (invoice.miscTotal || 0);
            summaryRows.push({
              label: "Total",
              value: fmtMoney(overallSubtotal, rs),
            });
            if (invoice.discountAmount > 0) {
              summaryRows.push({
                label: invoice.discountPercent > 0 ? `Room Discount (${invoice.discountPercent}%)` : "Discount",
                value: `−${fmtMoney(invoice.discountAmount, rs)}`,
              });
            }
            if (invoice.foodServiceCharge && invoice.foodServiceCharge > 0) {
              summaryRows.push({
                label: "Food Service",
                value: fmtMoney(invoice.foodServiceCharge, rs),
              });
            }
            if (invoice.roomTaxAmount > 0) {
              summaryRows.push({
                label: `Room GST${invoice.taxPercent > 0 ? ` (${invoice.taxPercent}%)` : ""}`,
                value: fmtMoney(invoice.roomTaxAmount, rs),
              });
            }
            if (invoice.foodTaxAmount > 0) {
              summaryRows.push({
                label: "Food GST",
                value: fmtMoney(invoice.foodTaxAmount, rs),
              });
            }
            if (invoice.miscTotal && invoice.miscTotal > 0) {
              summaryRows.push({
                label: "Misc GST",
                value: "0% (Exempt)",
              });
            }
          }

          const hasLineItems =
            showRoom ||
            (showFood && invoice.foodLines.length > 0) ||
            (showMisc && Boolean(invoice.miscLines?.length));

          return (
            <div style={{ marginTop: 8 }}>
              {/* Structured Invoice Table */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  color: INK,
                  fontFamily: "Arial, Helvetica, sans-serif",
                }}
              >
                <colgroup>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "52%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "19%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={thCell}>Qty</th>
                    <th style={thCell}>Item Detail</th>
                    <th style={thCell}>Price</th>
                    <th style={thCell}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Room lines */}
                  {showRoom ? (
                    <>
                      <tr>
                        <td style={tdCell}>{invoice.nights}</td>
                        <td style={tdCell}>
                          Room {invoice.roomNumber} — Accommodation
                          <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 2 }}>
                            {invoice.nights} night{invoice.nights === 1 ? "" : "s"} @ {fmtMoney(invoice.nightlyRate, rs)}
                            {invoice.discountPercent > 0 ? ` · ${invoice.discountPercent}% off` : ""}
                          </span>
                        </td>
                        <td style={tdCell}>{fmtMoney(invoice.nightlyRate, rs)}</td>
                        <td style={tdCell}>
                          {fmtMoney(invoice.roomChargesBefore || invoice.roomCharges, rs)}
                        </td>
                      </tr>
                      {invoice.otherExtras > 0 ? (
                        <tr>
                          <td style={tdCell}>1</td>
                          <td style={tdCell}>Extras / Additional room charges</td>
                          <td style={tdCell}>{fmtMoney(invoice.otherExtras, rs)}</td>
                          <td style={tdCell}>{fmtMoney(invoice.otherExtras, rs)}</td>
                        </tr>
                      ) : null}
                    </>
                  ) : null}

                  {/* Food lines */}
                  {showFood
                    ? invoice.foodLines.map((line, i) => (
                        <tr key={`${line.orderToken}-${i}`}>
                          <td style={tdCell}>{line.qty}</td>
                          <td style={tdCell}>
                            {line.name}
                            {line.orderToken ? (
                              <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 2 }}>
                                Order #{line.orderToken} · {line.paymentStatus === "paid" ? "Paid" : "Due"}
                              </span>
                            ) : null}
                          </td>
                          <td style={tdCell}>{fmtMoney(line.unitPrice, rs)}</td>
                          <td style={tdCell}>{fmtMoney(line.amount, rs)}</td>
                        </tr>
                      ))
                    : null}

                  {/* Misc lines */}
                  {showMisc && invoice.miscLines?.length
                    ? invoice.miscLines.map((line, i) => (
                        <tr key={`${line.billNumber}-${line.name}-${i}`}>
                          <td style={tdCell}>{line.qty}</td>
                          <td style={tdCell}>
                            {line.name}
                            {line.billNumber ? (
                              <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 2 }}>
                                {line.billNumber} · Miscellaneous · {line.paymentStatus === "paid" ? "Paid" : "Due"}
                              </span>
                            ) : null}
                          </td>
                          <td style={tdCell}>{fmtMoney(line.unitPrice, rs)}</td>
                          <td style={tdCell}>{fmtMoney(line.amount, rs)}</td>
                        </tr>
                      ))
                    : null}

                  {!hasLineItems ? (
                    <tr>
                      <td colSpan={4} style={{ ...tdCell, textAlign: "center", padding: "16px", color: MUTED }}>
                        No items recorded
                      </td>
                    </tr>
                  ) : null}

                  {/* Summary Rows (aligned in Price & Amount columns) */}
                  {summaryRows.map((row, idx) => (
                    <tr key={idx}>
                      <td colSpan={2} style={{ border: "none" }} />
                      <td style={tdSummaryLabel}>{row.label}</td>
                      <td style={tdSummaryValue}>{row.value}</td>
                    </tr>
                  ))}

                  {/* Spacer before Grand Total */}
                  <tr style={{ height: 10 }}>
                    <td colSpan={4} style={{ border: "none", padding: 0 }} />
                  </tr>

                  {/* Grand Total Row */}
                  <tr>
                    <td colSpan={3} style={tdGrandTotalLabel}>
                      Grand Total
                    </td>
                    <td style={tdGrandTotalValue}>
                      {fmtMoney(invoice.totalBill, rs)}
                    </td>
                  </tr>

                  {/* Amount Paid */}
                  <tr>
                    <td colSpan={3} style={tdSettlementLabel}>
                      Amount Paid
                    </td>
                    <td style={tdSettlementValue}>
                      {fmtMoney(invoice.amountPaid, rs)}
                    </td>
                  </tr>

                  {/* Balance Due */}
                  <tr>
                    <td colSpan={3} style={tdSettlementLabel}>
                      Balance Due
                    </td>
                    <td
                      style={{
                        ...tdSettlementValue,
                        color: invoice.balanceDue > 0 ? "#b91c1c" : INK,
                      }}
                    >
                      {fmtMoney(invoice.balanceDue, rs)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Overall Stay Category Breakdown (for combined folio) */}
              {isOverall ? (
                <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${LINE}` }}>
                  <p style={summaryHeading}>Stay Folio Summary</p>
                  {roomGstPending ? (
                    <p style={{ margin: "0 0 10px", fontSize: 11, color: MUTED }}>
                      Room GST will be added when the due room bill is cleared at checkout.
                    </p>
                  ) : null}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        invoice.miscTotal && invoice.miscTotal > 0
                          ? "repeat(auto-fit, minmax(180px, 1fr))"
                          : "1fr 1fr",
                      gap: 16,
                    }}
                  >
                    <div style={summaryPanel}>
                      <p style={summaryHeading}>Room breakdown</p>
                      <div style={totalRow}>
                        <span style={{ color: MUTED }}>Room subtotal</span>
                        <span>{fmtMoney(invoice.roomChargesBefore || invoice.roomCharges, rs)}</span>
                      </div>
                      {invoice.roomTaxAmount > 0 ? (
                        <div style={totalRow}>
                          <span style={{ color: MUTED }}>Room GST</span>
                          <span>{fmtMoney(invoice.roomTaxAmount, rs)}</span>
                        </div>
                      ) : null}
                      {invoice.discountAmount > 0 ? (
                        <div style={totalRow}>
                          <span style={{ color: MUTED }}>Discount</span>
                          <span>−{fmtMoney(invoice.discountAmount, rs)}</span>
                        </div>
                      ) : null}
                      <div
                        style={{
                          ...totalRow,
                          marginTop: 6,
                          borderTop: `1px solid ${LINE}`,
                          paddingTop: 8,
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ color: MUTED }}>Room total</span>
                        <span>
                          {fmtMoney(invoice.roomCharges + invoice.otherExtras + invoice.roomTaxAmount, rs)}
                        </span>
                      </div>
                    </div>

                    <div style={summaryPanel}>
                      <p style={summaryHeading}>Food breakdown</p>
                      <div style={totalRow}>
                        <span style={{ color: MUTED }}>Food subtotal</span>
                        <span>{fmtMoney(invoice.foodTotal, rs)}</span>
                      </div>
                      {invoice.foodTaxAmount > 0 ? (
                        <div style={totalRow}>
                          <span style={{ color: MUTED }}>Food GST</span>
                          <span>{fmtMoney(invoice.foodTaxAmount, rs)}</span>
                        </div>
                      ) : null}
                      <div
                        style={{
                          ...totalRow,
                          marginTop: 6,
                          borderTop: `1px solid ${LINE}`,
                          paddingTop: 8,
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ color: MUTED }}>Food total</span>
                        <span>{fmtMoney(invoice.foodTotal + invoice.foodTaxAmount, rs)}</span>
                      </div>
                    </div>

                    {invoice.miscTotal && invoice.miscTotal > 0 ? (
                      <div style={summaryPanel}>
                        <p style={summaryHeading}>Miscellaneous (No GST)</p>
                        <div style={totalRow}>
                          <span style={{ color: MUTED }}>Misc subtotal</span>
                          <span>{fmtMoney(invoice.miscTotal, rs)}</span>
                        </div>
                        <div style={totalRow}>
                          <span style={{ color: MUTED }}>GST (0% Exempt)</span>
                          <span>{fmtMoney(0, rs)}</span>
                        </div>
                        <div
                          style={{
                            ...totalRow,
                            marginTop: 6,
                            borderTop: `1px solid ${LINE}`,
                            paddingTop: 8,
                            fontWeight: 700,
                          }}
                        >
                          <span style={{ color: MUTED }}>Misc total</span>
                          <span>{fmtMoney(invoice.miscTotal, rs)}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })()}

        {/* Footer */}
        <div
          style={{
            marginTop: 56,
            paddingTop: 28,
            borderTop: `1px solid ${LINE}`,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 28,
          }}
        >
          <div>
            <p style={footerTitle}>Terms &amp; conditions</p>
            <ul
              style={{
                ...footerBody,
                padding: 0,
                paddingLeft: 16,
                listStyleType: "disc",
              }}
            >
              <li>Extra mattress: Rs 2,000 per day</li>
              <li>Mandatory check-in: 2:00 PM</li>
              <li>Mandatory check-out: 11:00 AM</li>
              <li>
                Late check-out fine: Rs 1,500 per hour; after 3 hours, full day
                rent
              </li>
            </ul>
          </div>
          <div>
            <p style={footerTitle}>Payment information</p>
            <p style={footerBody}>
              Please settle any balance due before or at check-out.
              <br />
              Status: {statusLabel} · {paymentPlanLabel(invoice.paymentTiming)}
              {invoice.paymentMethod ? (
                <>
                  <br />
                  Method: {invoice.paymentMethod}
                </>
              ) : null}
            </p>
          </div>
        </div>

        {/* Signature lines for printed copies */}
        <div
          style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
          }}
        >
          <div>
            <div
              style={{
                borderBottom: `1px solid ${RULE}`,
                height: 48,
                marginBottom: 8,
              }}
            />
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              Guest signature
            </p>
          </div>
          <div>
            <div
              style={{
                borderBottom: `1px solid ${RULE}`,
                height: 48,
                marginBottom: 8,
              }}
            />
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              Signature of entity
            </p>
          </div>
        </div>

        <p
          style={{
            margin: "32px 0 0",
            textAlign: "center",
            fontSize: 11,
            color: MUTED,
          }}
        >
          {isFood
            ? "Thank you for dining with us"
            : isMisc
              ? "Thank you for choosing our services"
              : "Thank you for staying with us"} ·{" "}
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

const summaryHeading: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: MUTED,
};

const summaryPanel: CSSProperties = {
  border: `1px solid ${LINE}`,
  padding: "14px 16px 12px",
  background: PAPER,
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

const thCell: CSSProperties = {
  border: `1px solid ${RULE}`,
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 700,
  color: INK,
  background: PAPER,
  boxSizing: "border-box",
};

const tdCell: CSSProperties = {
  border: `1px solid ${RULE}`,
  padding: "7px 10px",
  textAlign: "left",
  fontSize: 13,
  color: INK,
  background: PAPER,
  verticalAlign: "middle",
  boxSizing: "border-box",
};

const tdSummaryLabel: CSSProperties = {
  border: `1px solid ${RULE}`,
  padding: "6px 10px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 700,
  color: INK,
  background: PAPER,
  boxSizing: "border-box",
};

const tdSummaryValue: CSSProperties = {
  border: `1px solid ${RULE}`,
  padding: "6px 10px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 600,
  color: INK,
  background: PAPER,
  boxSizing: "border-box",
};

const tdGrandTotalLabel: CSSProperties = {
  border: `1px solid ${RULE}`,
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 14,
  fontWeight: 700,
  color: INK,
  background: PAPER,
  boxSizing: "border-box",
};

const tdGrandTotalValue: CSSProperties = {
  border: `1px solid ${RULE}`,
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 14,
  fontWeight: 700,
  color: INK,
  background: PAPER,
  boxSizing: "border-box",
};

const tdSettlementLabel: CSSProperties = {
  border: `1px solid ${RULE}`,
  padding: "7px 10px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 700,
  color: INK,
  background: PAPER,
  boxSizing: "border-box",
};

const tdSettlementValue: CSSProperties = {
  border: `1px solid ${RULE}`,
  padding: "7px 10px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 700,
  color: INK,
  background: PAPER,
  boxSizing: "border-box",
};

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
