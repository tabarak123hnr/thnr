import nodemailer from "nodemailer";

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  const portNum = Number(process.env.SMTP_PORT) || 587;
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    portNum === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: portNum,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: String(process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    },
  });
}

function fromAddress() {
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  const name = process.env.HOTEL_NAME || process.env.VITE_HOTEL_NAME || "Tabarak Hotel";
  return `"${name}" <${process.env.SMTP_USER}>`;
}

/**
 * Vercel serverless: POST /api/send-guest-email
 * Env: SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT, SMTP_SECURE, SMTP_FROM, HOTEL_NAME
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    if (!smtpConfigured()) {
      return res.status(503).json({
        error:
          "SMTP is not configured on Vercel. Add SMTP_HOST, SMTP_USER, and SMTP_PASS in Project Settings → Environment Variables.",
      });
    }

    const { to, subject, text, html, replyTo } = req.body || {};
    if (!to || typeof to !== "string" || !to.includes("@")) {
      return res.status(400).json({ error: "Valid guest email (to) is required." });
    }
    if (!subject || !text) {
      return res.status(400).json({ error: "subject and text are required." });
    }

    await createTransport().sendMail({
      from: fromAddress(),
      to: to.trim(),
      subject: String(subject),
      text: String(text),
      html: html ? String(html) : undefined,
      replyTo: replyTo ? String(replyTo) : undefined,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[vercel-email]", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to send email.",
    });
  }
}
