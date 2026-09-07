/**
 * Public guest feedback form URL from env (FEEDBACK_LINK).
 * Not shown in the staff UI — used for QR / check-in emails only.
 */
export function getFeedbackLink(): string {
  const raw =
    (import.meta.env.FEEDBACK_LINK as string | undefined)?.trim() ||
    (import.meta.env.VITE_FEEDBACK_LINK as string | undefined)?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

/** PNG QR image URL for email clients (points at FEEDBACK_LINK). */
export function getFeedbackQrImageUrl(size = 160): string | null {
  const link = getFeedbackLink();
  if (!link) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}`;
}
