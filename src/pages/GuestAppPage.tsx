import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Field, Input, PageHeader, Select } from "../components/ui/Page";
import { useApp } from "../context/app-context";

export function GuestAppPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader
        title={t.pages.guestAppTitle}
        subtitle={t.pages.guestAppSub}
        actions={<Button>{t.common.save}</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Guest experience" badge={<Badge tone="success">Live</Badge>} />
          <div className="space-y-4">
            <Field label="Welcome message (English)">
              <Input defaultValue="Welcome to Tabarak. Order food or request housekeeping from your phone." />
            </Field>
            <Field label="Welcome message (Urdu)">
              <Input defaultValue="تبارک میں خوش آمدید۔ اپنے فون سے آرڈر یا صفائی کی درخواست کریں۔" />
            </Field>
            <Field label="Ordering window">
              <Select defaultValue="24">
                <option value="24">24 hours</option>
                <option value="kitchen">Kitchen hours only</option>
              </Select>
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Modules" />
          <ul className="space-y-3">
            {[
              ["Room service ordering", true],
              ["Housekeeping requests", true],
              ["Late checkout request", true],
              ["Digital invoice view", false],
              ["Feedback after checkout", true],
            ].map(([label, on]) => (
              <li
                key={String(label)}
                className="flex items-center justify-between rounded-xl border border-app px-4 py-3"
              >
                <span className="text-sm font-medium">{label as string}</span>
                <Badge tone={on ? "gold" : "muted"}>{on ? "On" : "Off"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
