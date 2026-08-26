/**
 * Vercel serverless: GET /api/email/status
 */
export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const configured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );

  return res.status(200).json({
    ok: true,
    configured,
    hotelName: process.env.HOTEL_NAME || process.env.VITE_HOTEL_NAME || null,
  });
}
