import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { PageHeader, StatCard } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { formatRs } from "../lib/utils";

const ledger = [
  { label: "Cash drawer", value: 18500, tone: "gold" as const },
  { label: "Card settlements", value: 12400, tone: "info" as const },
  { label: "Room deposits", value: 30000, tone: "success" as const },
  { label: "Refunds", value: -950, tone: "danger" as const },
];

const dayClose = [
  { time: "08:00", note: "Opening float verified", by: "Kamran" },
  { time: "14:10", note: "Lunch shift cash drop", by: "Usman" },
  { time: "18:00", note: "Pending night audit", by: "—" },
];

export function AccountsPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader
        title={t.pages.accountsTitle}
        subtitle={t.pages.accountsSub}
        actions={
          <>
            <Button variant="secondary">{t.common.export}</Button>
            <Button variant="gold">Close day</Button>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today net" value={formatRs(59950, t.common.rs)} />
        <StatCard label="Cash on hand" value={formatRs(18500, t.common.rs)} />
        <StatCard label="Outstanding folios" value={formatRs(48000, t.common.rs)} />
        <StatCard label="Expenses" value={formatRs(4200, t.common.rs)} hint="Supplies + utilities" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ledger snapshot" />
          <ul className="space-y-3">
            {ledger.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between rounded-xl border border-app bg-app px-4 py-3"
              >
                <span className="text-sm font-medium">{row.label}</span>
                <Badge tone={row.tone}>{formatRs(row.value, t.common.rs)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Day close trail" />
          <ol className="space-y-4">
            {dayClose.map((row) => (
              <li key={row.time} className="flex gap-3">
                <span className="mt-0.5 w-12 shrink-0 text-xs font-bold text-[var(--accent)]">
                  {row.time}
                </span>
                <div>
                  <p className="text-sm font-semibold">{row.note}</p>
                  <p className="text-xs text-muted">{row.by}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
