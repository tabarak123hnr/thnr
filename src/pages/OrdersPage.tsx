import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { liveOrders } from "../data/mock";
import { formatAge, formatRs } from "../lib/utils";

const statusTone = {
  preparing: "warning",
  on_the_way: "purple",
  received: "info",
  served: "success",
  cancelled: "danger",
} as const;

const sourceTone = {
  table: "muted",
  room: "warning",
  takeaway: "info",
  counter: "gold",
} as const;

export function OrdersPage() {
  const { t, language } = useApp();

  return (
    <div>
      <PageHeader
        title={t.pages.ordersTitle}
        subtitle={t.pages.ordersSub}
        actions={
          <>
            <Button variant="secondary">{t.common.filter}</Button>
            <Button>{t.newOrder}</Button>
          </>
        }
      />
      <Card>
        <Table
          headers={[t.token, t.from, t.items, t.common.amount, t.status, t.age, t.common.actions]}
        >
          {liveOrders.map((order) => (
            <Tr key={order.id}>
              <Td className="font-bold">{order.token}</Td>
              <Td>
                <Badge tone={sourceTone[order.source]}>{order.sourceLabel}</Badge>
              </Td>
              <Td className="max-w-xs">
                {order.items
                  .map((i) => `${i.qty}× ${language === "ur" ? i.nameUr : i.name}`)
                  .join(", ")}
              </Td>
              <Td className="font-semibold">{formatRs(order.amount, t.common.rs)}</Td>
              <Td>
                <Badge tone={statusTone[order.status]}>
                  {order.status === "preparing"
                    ? t.preparing
                    : order.status === "on_the_way"
                      ? t.onTheWay
                      : order.status === "received"
                        ? t.received
                        : order.status === "served"
                          ? t.served
                          : t.cancelled}
                </Badge>
              </Td>
              <Td className="text-muted">{formatAge(order.ageMinutes)}</Td>
              <Td>
                <Button size="sm" variant="secondary">
                  Advance
                </Button>
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
