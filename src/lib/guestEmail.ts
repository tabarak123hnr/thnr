import {
  paymentPlanLabel,
  paymentStatusLabel,
  resolveAmountPaid,
  resolveBalanceDue,
} from "./paymentDisplay";
import { formatRs } from "./utils";
import type { CheckInRecord, PaymentStatus, PaymentTiming } from "../types/checkIn";

const hotelName =
  (import.meta.env.VITE_HOTEL_NAME as string | undefined) || "Tabarak Hotel & Restaurant";

/** API path (Vite proxies /api → Nodemailer server in dev). */
function emailApiUrl(path: string) {
  const base = (import.meta.env.VITE_EMAIL_API_URL as string | undefined)?.replace(/\/$/, "") || "";
  return `${base}${path}`;
}

/**
 * True when the app is set up to use the Nodemailer email server.
 * Set VITE_GUEST_EMAIL_ENABLED=false to skip sending entirely.
 */
export function isGuestEmailConfigured() {
  return import.meta.env.VITE_GUEST_EMAIL_ENABLED !== "false";
}

function formatWhen(iso: string) {
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

export type GuestCheckInEmailPayload = {
  guestName: string;
  email: string;
  phone: string;
  roomNumber: string;
  checkInAt: string;
  checkOutAt: string;
  nights: number;
  nightlyRate: number;
  totalBill: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  paymentTiming: PaymentTiming;
  adults: number;
  children: number;
  nationality?: string;
  cnic?: string;
  notes?: string;
  rs?: string;
};

/** Build plain-text + HTML body for the guest confirmation. */
export function buildGuestCheckInEmail(payload: GuestCheckInEmailPayload) {
  const rs = payload.rs || "Rs";
  const paymentLine =
    payload.paymentStatus === "partial" ||
    (payload.amountPaid > 0 && payload.balanceDue > 0)
      ? `Payment: ${paymentStatusLabel(payload.paymentStatus)} — Paid ${formatRs(payload.amountPaid, rs)}, Remaining ${formatRs(payload.balanceDue, rs)}`
      : `Payment: ${paymentStatusLabel(payload.paymentStatus)} (${paymentPlanLabel(payload.paymentTiming)}) — Total ${formatRs(payload.totalBill, rs)}`;

  const subject = `${hotelName} — Check-in confirmation · Room ${payload.roomNumber}`;

  const text = [
    `Dear ${payload.guestName},`,
    ``,
    `Thank you for staying with ${hotelName}. Your check-in is confirmed.`,
    ``,
    `Room: ${payload.roomNumber}`,
    `Check-in: ${formatWhen(payload.checkInAt)}`,
    `Check-out: ${formatWhen(payload.checkOutAt)}`,
    `Nights: ${payload.nights}`,
    `Guests: ${payload.adults} adult(s), ${payload.children} child(ren)`,
    `Nightly rate: ${formatRs(payload.nightlyRate, rs)}`,
    `Total bill: ${formatRs(payload.totalBill, rs)}`,
    paymentLine,
    payload.phone ? `Phone on file: ${payload.phone}` : "",
    payload.cnic ? `CNIC on file: ${payload.cnic}` : "",
    payload.notes ? `Notes: ${payload.notes}` : "",
    ``,
    `We look forward to hosting you.`,
    `${hotelName}`,
  ]
    .filter(Boolean)
    .join("\n");

  const paidLabel = formatRs(payload.amountPaid, rs);
  const dueLabel = formatRs(payload.balanceDue, rs);
  const totalLabel = formatRs(payload.totalBill, rs);
  const rateLabel = formatRs(payload.nightlyRate, rs);
  const statusText = paymentStatusLabel(payload.paymentStatus);
  const planText = paymentPlanLabel(payload.paymentTiming);
  const dueColor = payload.balanceDue > 0 ? "#c0392b" : "#1a7f4b";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#e8e4dc;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e8e4dc;padding:16px 8px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#fffcf7;border-radius:4px;overflow:hidden;">
          <!-- Header: stacked for mobile -->
          <tr>
            <td style="background:#111111;padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:5px;background:#b8860b;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:22px 18px 20px;">
                    <p style="margin:0;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#b8860b;">
                      Check-in confirmation
                    </p>
                    <h1 style="margin:8px 0 0;font-family:Georgia,Times New Roman,serif;font-size:22px;font-weight:700;line-height:1.25;color:#ffffff;">
                      ${escapeHtml(hotelName)}
                    </h1>
                    <p style="margin:8px 0 0;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:12px;color:#b0b0b0;line-height:1.4;">
                      Hotel &amp; Restaurant · Guest folio
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
                      <tr>
                        <td style="background:#1c1c1c;border:1px solid #333333;border-radius:8px;padding:8px 14px;">
                          <p style="margin:0;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#888888;">
                            Room
                          </p>
                          <p style="margin:4px 0 0;font-family:ui-monospace,Consolas,monospace;font-size:20px;font-weight:800;color:#b8860b;line-height:1;">
                            ${escapeHtml(payload.roomNumber)}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:3px;background:#b8860b;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Greeting -->
          <tr>
            <td style="padding:20px 18px 8px;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;color:#141414;">
              <p style="margin:0;font-size:15px;line-height:1.5;">
                Dear <strong>${escapeHtml(payload.guestName)}</strong>,
              </p>
              <p style="margin:10px 0 0;font-size:13px;line-height:1.55;color:#555555;">
                Thank you for choosing us. Your stay is confirmed — details below.
              </p>
            </td>
          </tr>
          <!-- Stay details: stacked rows (mobile-friendly) -->
          <tr>
            <td style="padding:12px 12px 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e8e4dc;border-radius:12px;">
                <tr>
                  <td style="padding:14px 14px 4px;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#b8860b;">
                    Stay details
                  </td>
                </tr>
                ${stackField("Check-in", formatWhen(payload.checkInAt))}
                ${stackField("Check-out", formatWhen(payload.checkOutAt))}
                ${stackField("Nights", String(payload.nights))}
                ${stackField("Guests", `${payload.adults} adult(s), ${payload.children} child(ren)`)}
                ${stackField("Nightly rate", rateLabel, !payload.phone && !payload.cnic)}
                ${payload.phone ? stackField("Phone", payload.phone, !payload.cnic) : ""}
                ${payload.cnic ? stackField("CNIC", payload.cnic, true) : ""}
              </table>
            </td>
          </tr>
          <!-- Bill summary: stacked -->
          <tr>
            <td style="padding:10px 12px 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:12px;overflow:hidden;border:1px solid #e8e4dc;">
                <tr>
                  <td style="background:#111111;padding:16px 14px;">
                    <p style="margin:0;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#b8860b;">
                      Bill summary
                    </p>
                    <p style="margin:10px 0 0;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:12px;color:#b0b0b0;">
                      Total stay
                    </p>
                    <p style="margin:4px 0 0;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;line-height:1.2;">
                      ${escapeHtml(totalLabel)}
                    </p>
                  </td>
                </tr>
                ${stackField("Payment status", statusText, false, true)}
                ${stackField("Payment plan", planText, false, true)}
                ${stackField("Paid so far", paidLabel, false, true, "#1a7f4b")}
                ${stackField("Balance due", dueLabel, true, true, dueColor)}
              </table>
            </td>
          </tr>
          ${
            payload.notes
              ? `<tr>
            <td style="padding:10px 12px 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f1ea;border-radius:10px;">
                <tr>
                  <td style="padding:12px 14px;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:13px;color:#555555;line-height:1.5;word-break:break-word;">
                    <strong style="color:#141414;">Notes:</strong> ${escapeHtml(payload.notes)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding:22px 18px 24px;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;text-align:center;">
              <div style="border-top:1px dashed #e8e4dc;padding-top:18px;">
                <p style="margin:0;font-size:14px;font-weight:700;color:#b8860b;">
                  Thank you for staying with us
                </p>
                <p style="margin:8px 0 0;font-size:12px;color:#6b6b6b;line-height:1.5;">
                  We look forward to hosting you.<br />
                  <strong style="color:#141414;">${escapeHtml(hotelName)}</strong>
                </p>
                <p style="margin:14px 0 0;font-size:11px;color:#999999;">
                  Automated confirmation — keep for your records.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/** Single-column field: label on top, value below — readable on phones. */
function stackField(
  label: string,
  value: string,
  last = false,
  inBill = false,
  valueColor = "#141414",
) {
  const border = last ? "none" : "1px solid #e8e4dc";
  const bg = inBill ? "#ffffff" : "transparent";
  return `<tr>
    <td style="padding:12px 14px;border-bottom:${border};background:${bg};font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;">
      <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#8a8a8a;">
        ${escapeHtml(label)}
      </p>
      <p style="margin:5px 0 0;font-size:15px;font-weight:700;line-height:1.35;color:${valueColor};word-break:break-word;">
        ${escapeHtml(value)}
      </p>
    </td>
  </tr>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends guest check-in confirmation via Nodemailer API.
 *
 * Local: Vite proxies /api → `npm run email-server` (SMTP_* in repo .env).
 * Production: Firebase Function `api` + Hosting rewrite /api/** (SMTP_* on the function).
 * Or set VITE_EMAIL_API_URL to the function base URL.
 */
export async function sendGuestCheckInEmail(payload: GuestCheckInEmailPayload) {
  const to = payload.email.trim();
  if (!to || !to.includes("@")) {
    throw new Error("Guest email is required to send confirmation.");
  }
  if (!isGuestEmailConfigured()) {
    throw new Error("Guest email is disabled (VITE_GUEST_EMAIL_ENABLED=false).");
  }

  const { subject, text, html } = buildGuestCheckInEmail(payload);
  const url = emailApiUrl("/api/send-guest-email");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        text,
        html,
        replyTo: to,
      }),
    });
  } catch {
    throw new Error(
      "Email API is not reachable. Locally run `npm run email-server` (or `npm run dev`). In production deploy the email function (`npm run deploy:email`) and use Firebase Hosting rewrites, or set VITE_EMAIL_API_URL.",
    );
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
  if (res.status === 404) {
    throw new Error(
      "Email API not found (404). On Vercel, redeploy so /api/send-guest-email exists and set SMTP_HOST, SMTP_USER, SMTP_PASS in Vercel Environment Variables (not VITE_*).",
    );
  }
  if (!res.ok) {
    throw new Error(
      data.error ||
        `Email failed (${res.status}). Check SMTP_HOST / SMTP_USER / SMTP_PASS on the email server (Cloud Function), not only in the frontend .env.`,
    );
  }
}

export function guestEmailPayloadFromCheckIn(
  row: Pick<
    CheckInRecord,
    | "guestName"
    | "email"
    | "phone"
    | "roomNumber"
    | "checkInAt"
    | "checkOutAt"
    | "nights"
    | "nightlyRate"
    | "totalBill"
    | "amountPaid"
    | "balanceDue"
    | "paymentStatus"
    | "paymentTiming"
    | "adults"
    | "children"
    | "nationality"
    | "cnic"
    | "notes"
  >,
  rs = "Rs",
): GuestCheckInEmailPayload {
  return {
    guestName: row.guestName,
    email: row.email,
    phone: row.phone,
    roomNumber: row.roomNumber,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    nights: row.nights,
    nightlyRate: row.nightlyRate,
    totalBill: row.totalBill,
    amountPaid: resolveAmountPaid(row),
    balanceDue: resolveBalanceDue(row),
    paymentStatus: row.paymentStatus,
    paymentTiming: row.paymentTiming,
    adults: row.adults,
    children: row.children,
    nationality: row.nationality,
    cnic: row.cnic,
    notes: row.notes,
    rs,
  };
}
