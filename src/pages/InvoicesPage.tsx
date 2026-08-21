import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader, StatCard } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { invoices } from "../data/mock";
import { formatRs } from "../lib/utils";

const statusTone = {
  paid: "success",
  unpaid: "danger",
  partial: "warning",
  void: "muted",
} as const;

export function InvoicesPage() {
  const { t } = useApp();
  const unpaid = invoices.filter((i) => i.status === "unpaid" || i.status === "partial");
  const collected = invoices.reduce((s, i) => s + i.paid, 0);

  return (
    <div>
      <PageHeader
        title={t.pages.invoicesTitle}
        subtitle={t.pages.invoicesSub}
        actions={
          <>
            <Button variant="secondary">{t.common.export}</Button>
            <Button>{t.common.add} invoice</Button>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Invoices today" value={String(invoices.length)} />
        <StatCard label="Collected" value={formatRs(collected, t.common.rs)} />
        <StatCard label="Open balance" value={String(unpaid.length)} alert={unpaid.length} />
      </div>
      <Card>
        <Table
          headers={[
            "Invoice",
            t.common.guest,
            t.common.type,
            t.common.date,
            t.common.amount,
            t.common.paid,
            t.status,
            t.common.actions,
          ]}
        >
          {invoices.map((inv) => (
            <Tr key={inv.id}>
              <Td className="font-bold">{inv.number}</Td>
              <Td>{inv.guest}</Td>
              <Td>
                <Badge tone="muted">{inv.type}</Badge>
              </Td>
              <Td className="text-muted">{inv.date}</Td>
              <Td className="font-semibold">{formatRs(inv.amount, t.common.rs)}</Td>
              <Td>{formatRs(inv.paid, t.common.rs)}</Td>
              <Td>
                <Badge tone={statusTone[inv.status]}>
                  {t.common[inv.status as "paid" | "unpaid" | "partial" | "void"]}
                </Badge>
              </Td>
              <Td>
                <Button size="sm" variant="secondary">
                  Open
                </Button>
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
