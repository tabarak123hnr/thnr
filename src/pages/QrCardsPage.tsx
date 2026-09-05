import { QrCode } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { rooms } from "../data/mock";

export function QrCardsPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader
        title={t.pages.qrTitle}
        subtitle={t.pages.qrSub}
        actions={
          <>
            <Button variant="secondary" className="w-full sm:w-auto">
              Print selected
            </Button>
            <Button className="w-full sm:w-auto">Generate all</Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card className="flex flex-col items-center text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-dashed border-app bg-app">
            <QrCode className="h-14 w-14 text-[var(--accent)]" />
          </div>
          <p className="mt-4 font-bold">Restaurant menu</p>
          <p className="mt-1 text-xs text-muted">Guest Wi‑Fi → digital menu</p>
          <Button size="sm" variant="secondary" className="mt-4">
            Download
          </Button>
        </Card>
        {rooms.slice(0, 7).map((room) => (
          <Card key={room.id} className="flex flex-col items-center text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-dashed border-app bg-app">
              <QrCode className="h-14 w-14 text-[var(--text)]" />
            </div>
            <p className="mt-4 font-bold">
              {t.common.room} {room.number}
            </p>
            <p className="mt-1 text-xs text-muted">Room service + requests</p>
            <Button size="sm" variant="secondary" className="mt-4">
              Download
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
