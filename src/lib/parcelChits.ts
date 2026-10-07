import { parcelLineQty, parcelLineTotal, type ParcelLine } from "../types/parcel";
import { formatRs } from "./utils";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ParcelChitPrintInput = {
  token: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  paymentStatus: "paid" | "due";
  lines: ParcelLine[];
  amount: number;
  rs?: string;
  brand?: string;
};

const PRINT_STYLES = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      max-width: 360px;
      margin: 0 auto 18px;
      border: 1px solid #222;
      padding: 14px 16px;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    header { text-align: center; border-bottom: 1px dashed #444; padding-bottom: 10px; margin-bottom: 12px; }
    .brand { margin: 0; font-size: 13px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
    .channel { margin: 4px 0 0; font-size: 18px; font-weight: 900; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-bottom: 12px; font-size: 12px; }
    .meta span { display: block; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
    .meta strong { font-size: 13px; }
    .item { text-align: center; padding: 16px 8px; border: 1px dashed #999; margin-bottom: 10px; }
    .name { margin: 0; font-size: 22px; font-weight: 900; }
    .name-ur { margin: 6px 0 0; font-size: 16px; }
    .qty { margin: 10px 0 0; font-size: 13px; color: #444; }
    .price { margin: 8px 0 0; font-size: 20px; font-weight: 800; }
    .customer, .notes, .foot { font-size: 12px; color: #444; margin: 8px 0 0; }
    .foot { border-top: 1px dashed #aaa; padding-top: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; }
    th { font-size: 10px; text-transform: uppercase; color: #666; }
    .num { text-align: right; white-space: nowrap; }
    .total { margin: 14px 0 0; font-size: 20px; font-weight: 900; text-align: right; }
    @page { margin: 8mm; size: A5; }
    @media print {
      body { padding: 0; }
      .page { border-color: #000; margin: 0 auto 0; max-width: none; }
    }
  `;

function buildPrintHtml(input: ParcelChitPrintInput) {
  const rs = input.rs || "Rs";
  const brand = input.brand || "Tabarak Hotel & Restaurant";
  const when = new Date().toLocaleString();

  const chitPages = input.lines
    .map((line, index) => {
      const qty = parcelLineQty(line);
      const lineTotal = parcelLineTotal(line);
      return `
      <section class="chit page">
        <header>
          <p class="brand">${escapeHtml(brand)}</p>
          <p class="channel">PARCEL CHIT</p>
        </header>
        <div class="meta">
          <div><span>Order</span><strong>${escapeHtml(input.token)}</strong></div>
          <div><span>Chit</span><strong>${escapeHtml(line.chitNo)}</strong></div>
          <div><span>Dish</span><strong>#${index + 1} of ${input.lines.length}</strong></div>
          <div><span>Time</span><strong>${escapeHtml(when)}</strong></div>
        </div>
        <div class="item">
          <p class="name">${escapeHtml(line.name)}</p>
          ${line.nameUr ? `<p class="name-ur">${escapeHtml(line.nameUr)}</p>` : ""}
          <p class="qty">Qty: ${qty}</p>
          <p class="price">${escapeHtml(formatRs(lineTotal, rs))}</p>
          <p class="qty">@ ${escapeHtml(formatRs(line.unitPrice, rs))} each</p>
        </div>
        ${
          input.customerName || input.customerPhone
            ? `<p class="customer">${escapeHtml(
                [input.customerName, input.customerPhone].filter(Boolean).join(" · "),
              )}</p>`
            : ""
        }
        <p class="foot">Kitchen slip · ${escapeHtml(input.paymentStatus.toUpperCase())}</p>
      </section>`;
    })
    .join("");

  const billRows = input.lines
    .map((line) => {
      const qty = parcelLineQty(line);
      return `
      <tr>
        <td>${escapeHtml(line.chitNo)}</td>
        <td>${escapeHtml(line.name)}</td>
        <td class="num">${qty}</td>
        <td class="num">${escapeHtml(formatRs(parcelLineTotal(line), rs))}</td>
      </tr>`;
    })
    .join("");

  const billPage = `
    <section class="bill page">
      <header>
        <p class="brand">${escapeHtml(brand)}</p>
        <p class="channel">PARCEL BILL (COMBINED)</p>
      </header>
      <div class="meta">
        <div><span>Order</span><strong>${escapeHtml(input.token)}</strong></div>
        <div><span>Chits</span><strong>${input.lines.length}</strong></div>
        <div><span>Time</span><strong>${escapeHtml(when)}</strong></div>
        <div><span>Payment</span><strong>${escapeHtml(input.paymentStatus.toUpperCase())}</strong></div>
      </div>
      ${
        input.customerName || input.customerPhone
          ? `<p class="customer">${escapeHtml(
              [input.customerName, input.customerPhone].filter(Boolean).join(" · "),
            )}</p>`
          : ""
      }
      <table>
        <thead>
          <tr>
            <th>Chit</th>
            <th>Item</th>
            <th class="num">Qty</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>${billRows}</tbody>
      </table>
      <p class="total">Total ${escapeHtml(formatRs(input.amount, rs))}</p>
      ${input.notes ? `<p class="notes">Notes: ${escapeHtml(input.notes)}</p>` : ""}
      <p class="foot">One chit per dish line · combined total above.</p>
    </section>`;

  return `<!DOCTYPE html><html><head><title>Parcel ${escapeHtml(input.token)}</title>
    <style>${PRINT_STYLES}</style></head><body>${chitPages}${billPage}</body></html>`;
}

/** Call synchronously from a click handler before any await. */
export function openParcelPrintWindow() {
  return window.open("", "_blank", "width=720,height=900");
}

export function renderParcelPrintDocument(win: Window, input: ParcelChitPrintInput) {
  win.document.open();
  win.document.write(buildPrintHtml(input));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

/** One slip per dish line + combined bill (opens window immediately). */
export function printParcelChits(input: ParcelChitPrintInput, existingWin?: Window | null) {
  const win = existingWin ?? openParcelPrintWindow();
  if (!win) {
    throw new Error("Pop-up blocked. Allow pop-ups to print chits.");
  }
  renderParcelPrintDocument(win, input);
}
