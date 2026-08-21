import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { bookingRequests } from "../data/mock";

const tones = {
  pending: "warning",
  confirmed: "success",
  cancelled: "danger",
  checked_in: "info",
} as const;

export function BookingRequestsPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader
        title={t.pages.bookingsTitle}
        subtitle={t.pages.bookingsSub}
        actions={<Button variant="secondary">{t.common.filter}</Button>}
      />
      <Card>
        <Table
          headers={[
            t.common.guest,
            t.common.phone,
            t.common.type,
            "Nights",
            t.common.checkIn,
            "Channel",
            t.status,
            t.common.actions,
          ]}
        >
          {bookingRequests.map((b) => (
            <Tr key={b.id}>
              <Td className="font-semibold">{b.guest}</Td>
              <Td className="text-muted">{b.phone}</Td>
              <Td>{b.roomType}</Td>
              <Td>{b.nights}</Td>
              <Td>{b.checkIn}</Td>
              <Td>
                <Badge tone="muted">{b.channel}</Badge>
              </Td>
              <Td>
                <Badge tone={tones[b.status]}>
                  {b.status === "pending"
                    ? t.common.pending
                    : b.status === "confirmed"
                      ? t.common.confirmed
                      : b.status}
                </Badge>
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Button size="sm" variant="gold">
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost">
                    Decline
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
