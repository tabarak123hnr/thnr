import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { PageHeader, StatCard } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { rooms } from "../data/mock";

const records = [
  {
    room: "7",
    guest: "Omar Sheikh",
    idStatus: "Missing scan",
    police: "Not submitted",
    tone: "danger" as const,
  },
  {
    room: "1",
    guest: "Ahmed Raza",
    idStatus: "Verified",
    police: "Submitted",
    tone: "success" as const,
  },
  {
    room: "2",
    guest: "Sara Khan",
    idStatus: "Verified",
    police: "Queued",
    tone: "warning" as const,
  },
  {
    room: "5",
    guest: "Bilal Hussain",
    idStatus: "Verified",
    police: "Submitted",
    tone: "success" as const,
  },
];

export function CompliancePage() {
  const { t } = useApp();
  const occupied = rooms.filter((r) => r.status === "occupied").length;

  return (
    <div>
      <PageHeader
        title={t.pages.complianceTitle}
        subtitle={t.pages.complianceSub}
        actions={<Button variant="secondary">{t.common.export}</Button>}
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Occupied guests" value={String(occupied)} />
        <StatCard label="Pending police records" value="1" alert={1} />
        <StatCard label="ID verification" value="4/5" hint="Complete tonight" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {records.map((row) => (
          <Card key={row.room}>
            <CardHeader
              title={`${t.common.room} ${row.room} · ${row.guest}`}
              badge={<Badge tone={row.tone}>{row.police}</Badge>}
            />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">ID status</dt>
                <dd className="mt-1 font-semibold">{row.idStatus}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Police record</dt>
                <dd className="mt-1 font-semibold">{row.police}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="gold">
                Attach ID
              </Button>
              <Button size="sm" variant="secondary">
                Submit record
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
