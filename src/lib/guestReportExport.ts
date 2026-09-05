import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { CheckInRecord } from "../types/checkIn";
import type { GuestInvoice } from "../types/invoice";
import type { FoodOrder } from "../types/order";
import { paymentPlanLabel } from "./paymentDisplay";
import { formatRs } from "./utils";

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtWhen(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return esc(
    d.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  );
}

function stayLabel(status: string) {
  if (status === "checked_in") return "In house";
  if (status === "checked_out") return "Checked out";
  if (status === "cancelled") return "Cancelled";
  return status;
}

const BW_CSS = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.4;
  }
  body { padding: 20px; }
  h1 { font-size: 20px; margin: 0 0 2px; font-weight: 700; color: #000000; }
  .sub { font-size: 11px; color: #000000; margin: 0 0 14px; }
  h2 {
    font-size: 13px;
    margin: 18px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #000000;
    font-weight: 700;
    color: #000000;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; }
  .cell { border: 1px solid #000000; padding: 8px 10px; background: #ffffff; }
  .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #000000; margin: 0 0 2px; }
  .value { font-size: 12px; font-weight: 700; color: #000000; word-break: break-word; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td {
    border: 1px solid #000000;
    padding: 5px 6px;
    text-align: left;
    vertical-align: top;
    background: #ffffff;
    color: #000000;
  }
  th { font-size: 9px; text-transform: uppercase; font-weight: 700; }
  td { font-size: 11px; }
  .block { border: 1px solid #000000; padding: 10px; margin-bottom: 10px; background: #ffffff; }
  .block-title { font-size: 14px; font-weight: 700; margin: 0 0 4px; }
  .muted { font-size: 11px; color: #000000; }
  ul { margin: 4px 0 0; padding-left: 16px; }
  li { margin: 2px 0; }
  @page { margin: 12mm; size: A4; }
  @media print {
    body { padding: 0; background: #ffffff; color: #000000; }
    * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
`;

export type GuestReportExportData = {
  guestName: string;
  phone: string;
  cnic: string;
  email: string;
  nationality: string;
  stayCount: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  stays: CheckInRecord[];
  orders: FoodOrder[];
  invoices: GuestInvoice[];
  stayAmountPaid: (row: CheckInRecord) => number;
  stayBalanceDue: (row: CheckInRecord) => number;
  isStaySettled: (row: CheckInRecord) => boolean;
  rs?: string;
};

/** Black-and-white HTML body (no oklch / CSS variables — safe for print & html2canvas). */
export function buildGuestReportBwHtml(data: GuestReportExportData): string {
  const rs = data.rs || "Rs";
  const latest = data.stays[0];

  const personal = `
    <h2>Personal information</h2>
    <div class="grid">
      <div class="cell"><p class="label">Name</p><p class="value">${esc(data.guestName)}</p></div>
      <div class="cell"><p class="label">Phone</p><p class="value">${esc(data.phone || "—")}</p></div>
      <div class="cell"><p class="label">CNIC</p><p class="value">${esc(data.cnic || "—")}</p></div>
      <div class="cell"><p class="label">Email</p><p class="value">${esc(data.email || "—")}</p></div>
      <div class="cell"><p class="label">Nationality</p><p class="value">${esc(data.nationality || "—")}</p></div>
      ${
        latest
          ? `<div class="cell"><p class="label">Adults / children</p><p class="value">${latest.adults} / ${latest.children}</p></div>
             <div class="cell"><p class="label">Purpose</p><p class="value">${esc(latest.purpose || "—")}</p></div>
             <div class="cell"><p class="label">Vehicle</p><p class="value">${esc([latest.vehicleColor, latest.vehicleNumber].filter(Boolean).join(" · ") || "—")}</p></div>`
          : ""
      }
    </div>
    <div class="grid">
      <div class="cell"><p class="label">Stays</p><p class="value">${data.stayCount}</p></div>
      <div class="cell"><p class="label">Room billed</p><p class="value">${esc(formatRs(data.totalBilled, rs))}</p></div>
      <div class="cell"><p class="label">Collected</p><p class="value">${esc(formatRs(data.totalPaid, rs))}</p></div>
      <div class="cell"><p class="label">Balance due</p><p class="value">${esc(formatRs(data.outstanding, rs))}</p></div>
    </div>
  `;

  const staysHtml =
    data.stays.length === 0
      ? `<p class="muted">No stays on record.</p>`
      : data.stays
          .map((row) => {
            const paid = data.stayAmountPaid(row);
            const due = data.stayBalanceDue(row);
            const settled = data.isStaySettled(row);
            return `
            <div class="block">
              <p class="block-title">Room ${esc(row.roomNumber)} · ${esc(stayLabel(row.status))}${settled ? " · Settled" : ""}</p>
              <p class="muted">${fmtWhen(row.checkInAt)} → ${fmtWhen(String(row.checkedOutAt || row.checkOutAt))} · ${row.nights || 0} night(s)</p>
              <div class="grid">
                <div class="cell"><p class="label">Payment plan</p><p class="value">${esc(paymentPlanLabel(row.paymentTiming))}</p></div>
                <div class="cell"><p class="label">Room / extras</p><p class="value">${esc(formatRs(row.roomCharges || 0, rs))} + ${esc(formatRs(row.extraCharges || 0, rs))}</p></div>
                <div class="cell"><p class="label">Paid</p><p class="value">${esc(formatRs(paid, rs))}</p></div>
                <div class="cell"><p class="label">Balance due</p><p class="value">${esc(formatRs(due, rs))}</p></div>
              </div>
              <p class="muted">Checked in by: ${esc(row.checkedInBy || "—")}${
                row.status === "checked_out"
                  ? ` · Checked out by: ${esc(row.checkedOutBy || "—")}`
                  : ""
              }</p>
              ${row.notes ? `<p class="muted">Notes: ${esc(row.notes)}</p>` : ""}
              ${
                row.companions?.length
                  ? `<p class="label">Companions</p><ul>${row.companions
                      .map(
                        (c) =>
                          `<li>${esc(c.name)}${c.relation ? ` · ${esc(c.relation)}` : ""}${c.cnic ? ` · ${esc(c.cnic)}` : ""}</li>`,
                      )
                      .join("")}</ul>`
                  : ""
              }
            </div>`;
          })
          .join("");

  const foodHtml =
    data.orders.length === 0
      ? `<p class="muted">No food orders.</p>`
      : `<table>
        <thead><tr><th>Token</th><th>Room</th><th>Items</th><th>Amount</th><th>Status</th><th>Payment</th></tr></thead>
        <tbody>
          ${data.orders
            .map(
              (o) => `<tr>
              <td>${esc(o.token)}</td>
              <td>${esc(o.roomNumber)}</td>
              <td>${esc(o.items.map((i) => `${i.qty}× ${i.name}`).join(", "))}</td>
              <td>${esc(formatRs(o.amount || 0, rs))}</td>
              <td>${esc(o.status)}</td>
              <td>${esc(o.paymentStatus === "paid" ? "Paid" : "Due")}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;

  const invHtml =
    data.invoices.length === 0
      ? `<p class="muted">No invoices.</p>`
      : `<table>
        <thead><tr><th>Invoice</th><th>Type</th><th>Room</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>
          ${data.invoices
            .map((inv) => {
              const due = Math.max(0, inv.balanceDue || 0);
              const status =
                due <= 0 ? "Paid" : inv.amountPaid > 0 ? "Partial" : "Unpaid";
              return `<tr>
              <td>${esc(inv.number)}</td>
              <td>${inv.type === "restaurant" ? "Food" : "Room"}</td>
              <td>${esc(inv.roomNumber)}</td>
              <td>${esc(formatRs(inv.totalBill, rs))}</td>
              <td>${esc(formatRs(inv.amountPaid, rs))}</td>
              <td>${esc(formatRs(due, rs))}</td>
              <td>${esc(status)}</td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;

  return `
    <h1>${esc(data.guestName)}</h1>
    <p class="sub">Guest report · Tabarak Hotel &amp; Restaurant · ${esc(new Date().toLocaleString())}</p>
    ${personal}
    <h2>Room bookings &amp; stays</h2>
    ${staysHtml}
    <h2>Food orders</h2>
    ${foodHtml}
    <h2>Bills / invoices</h2>
    ${invHtml}
  `;
}

function fullDocument(bodyHtml: string, title: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
    <style>${BW_CSS}</style></head><body>${bodyHtml}</body></html>`;
}

/** Print black-and-white guest report (ink-friendly). */
export function printGuestReportBw(bodyHtml: string, title = "Guest report") {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) {
    throw new Error("Pop-up blocked. Allow pop-ups to print this report.");
  }
  win.document.open();
  win.document.write(fullDocument(bodyHtml, title));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

/**
 * PDF from a standalone B&W HTML document in an iframe
 * (avoids html2canvas failing on Tailwind oklch colors).
 */
export async function downloadGuestReportPdf(
  bodyHtml: string,
  filename: string,
  title = "Guest report",
) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-12000px;top:0;width:794px;height:2000px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Could not create print document.");

    doc.open();
    doc.write(fullDocument(bodyHtml, title));
    doc.close();

    await new Promise<void>((resolve) => {
      if (doc.readyState === "complete") {
        setTimeout(() => resolve(), 80);
      } else {
        iframe.onload = () => setTimeout(() => resolve(), 80);
      }
    });

    const el = doc.body;
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    const name = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(name);
  } finally {
    iframe.remove();
  }
}
