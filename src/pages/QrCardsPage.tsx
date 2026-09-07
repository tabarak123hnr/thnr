import { Download } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { FEEDBACK_QR_PATH } from "../lib/feedbackLink";

export function QrCardsPage() {
  const { t } = useApp();
  const f = t.feedback;

  return (
    <div>
      <PageHeader
        title={t.pages.qrTitle}
        subtitle={t.pages.qrSub}
      />

      <div className="mx-auto max-w-md">
        <Card className="flex flex-col items-center text-center !p-6 sm:!p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            {t.brand}
          </p>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight">{f.qrCardTitle}</h2>
          <p className="mt-1 text-sm text-muted">{f.qrCardSub}</p>

          <div className="mt-6 rounded-2xl border border-app bg-white p-4 shadow-sm">
            <img
              src={FEEDBACK_QR_PATH}
              alt={f.qrCardTitle}
              className="h-52 w-52 object-contain sm:h-56 sm:w-56"
            />
          </div>

          <p className="mt-4 text-sm font-semibold">{f.scanToFeedback}</p>

          <a href={FEEDBACK_QR_PATH} download="tabarak-feedback-qr.png" className="mt-5">
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer"
              icon={<Download className="h-4 w-4" />}
            >
              {f.downloadQr}
            </Button>
          </a>
        </Card>
      </div>
    </div>
  );
}
