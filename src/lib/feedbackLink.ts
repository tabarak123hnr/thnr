/** Static QR PNG in /public — encodes the guest feedback form URL. */
export const FEEDBACK_QR_PATH = "/qrcode_thnr.vercel.app.png";

/** Inline CID used in check-in emails (works in Gmail without a public image URL). */
export const FEEDBACK_QR_CID = "qrcode_thnr.vercel.app.png@tabarak";

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

/** Site origin inferred from FEEDBACK_LINK (e.g. https://thnr.vercel.app). */
export function getAppOrigin(): string {
  const link = getFeedbackLink();
  if (link) {
    try {
      return new URL(link).origin;
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

/** Absolute URL to the feedback QR (for QR cards / fallback). */
export function getFeedbackQrImageUrl(): string | null {
  const origin = getAppOrigin();
  if (!origin) return null;
  return `${origin}${FEEDBACK_QR_PATH}`;
}

export type FeedbackQrAttachment = {
  filename: string;
  content: string;
  encoding: "base64";
  cid: string;
  contentType: string;
  contentDisposition: "inline";
};

/** Load local/public QR as a Nodemailer inline attachment (CID). */
export async function loadFeedbackQrAttachment(): Promise<FeedbackQrAttachment | null> {
  try {
    const src =
      typeof window !== "undefined"
        ? `${window.location.origin}${FEEDBACK_QR_PATH}`
        : getFeedbackQrImageUrl();
    if (!src) return null;
    const res = await fetch(src);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    return {
      filename: "qrcode_thnr.vercel.app.png",
      content: btoa(binary),
      encoding: "base64",
      cid: FEEDBACK_QR_CID,
      contentType: "image/png",
      contentDisposition: "inline",
    };
  } catch {
    return null;
  }
}
