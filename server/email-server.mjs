/**
 * Nodemailer SMTP API for guest check-in emails.
 * Run: npm run email-server
 * Vite proxies /api → this process in development.
 */
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
loadEnv({ path: resolve(root, ".env"), override: true });

const port = Number(process.env.EMAIL_SERVER_PORT) || 8787;
const host = process.env.EMAIL_SERVER_HOST || "127.0.0.1";

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
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
      // Gmail app passwords are often copied with spaces
      pass: String(process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    },
  });
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/email/status", (_req, res) => {
  res.json({
    ok: true,
    configured: smtpConfigured(),
    hotelName: process.env.HOTEL_NAME || process.env.VITE_HOTEL_NAME || null,
  });
});

app.post("/api/send-guest-email", async (req, res) => {
  try {
    if (!smtpConfigured()) {
      return res.status(503).json({
        error:
          "SMTP is not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to .env",
      });
    }

    const { to, subject, text, html, replyTo } = req.body || {};
    if (!to || typeof to !== "string" || !to.includes("@")) {
      return res.status(400).json({ error: "Valid guest email (to) is required." });
    }
    if (!subject || !text) {
      return res.status(400).json({ error: "subject and text are required." });
    }

    const from =
      process.env.SMTP_FROM ||
      `"${process.env.HOTEL_NAME || process.env.VITE_HOTEL_NAME || "Tabarak Hotel"}" <${process.env.SMTP_USER}>`;

    const transporter = createTransport();
    await transporter.sendMail({
      from,
      to: to.trim(),
      subject: String(subject),
      text: String(text),
      html: html ? String(html) : undefined,
      replyTo: replyTo ? String(replyTo) : undefined,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[email-server]", err);
    const message = err instanceof Error ? err.message : "Failed to send email.";
    return res.status(500).json({ error: message });
  }
});

app.listen(port, host, () => {
  console.log(`[email-server] http://${host}:${port}`);
  console.log(
    smtpConfigured()
      ? `[email-server] SMTP ready (${process.env.SMTP_HOST})`
      : "[email-server] SMTP not configured — set SMTP_HOST / SMTP_USER / SMTP_PASS in .env",
  );
});
