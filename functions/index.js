/**
 * Production email API (Nodemailer + SMTP) for Firebase Cloud Functions.
 *
 * Deploy:
 *   1) Copy SMTP_* into Google Cloud Console env for function `api`
 *      (or create functions/.env for emulator only — do not commit secrets)
 *   2) npm run deploy:email
 *   3) Deploy hosting with /api/** rewrite: npm run deploy:hosting
 */
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { config: loadEnv } = require("dotenv");
const { resolve } = require("node:path");
const { existsSync } = require("node:fs");

setGlobalOptions({ region: "us-central1" });

for (const p of [resolve(__dirname, ".env"), resolve(__dirname, "../.env")]) {
  if (existsSync(p)) loadEnv({ path: p, override: false });
}

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

async function handleSend(req, res) {
  try {
    if (!smtpConfigured()) {
      return res.status(503).json({
        error:
          "SMTP is not configured on the Cloud Function. Set SMTP_HOST, SMTP_USER, SMTP_PASS in the function’s runtime environment (Vite .env alone does not work in production).",
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

    return res.json({ ok: true });
  } catch (err) {
    console.error("[email-api]", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to send email.",
    });
  }
}

function handleStatus(_req, res) {
  res.json({
    ok: true,
    configured: smtpConfigured(),
    hotelName: process.env.HOTEL_NAME || process.env.VITE_HOTEL_NAME || null,
  });
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/email/status", handleStatus);
app.get("/email/status", handleStatus);
app.post("/api/send-guest-email", handleSend);
app.post("/send-guest-email", handleSend);

app.use((req, res) => {
  res.status(404).json({
    error: `Unknown email route: ${req.method} ${req.path}`,
  });
});

exports.api = onRequest(
  {
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  app,
);
