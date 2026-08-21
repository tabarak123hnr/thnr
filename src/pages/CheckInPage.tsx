import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, Input, PageHeader, Select, TextArea } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { rooms } from "../data/mock";

export function CheckInPage() {
  const { t, language } = useApp();
  const available = rooms.filter((r) => r.status === "available");

  return (
    <div>
      <PageHeader title={t.pages.checkInTitle} subtitle={t.pages.checkInSub} />
      <Card>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <Field label={t.common.name}>
            <Input placeholder="Full name" required />
          </Field>
          <Field label={t.common.phone}>
            <Input placeholder="03XX-XXXXXXX" required />
          </Field>
          <Field label={t.common.cnic}>
            <Input placeholder="XXXXX-XXXXXXX-X" required />
          </Field>
          <Field label={t.common.nationality}>
            <Input defaultValue="Pakistan" />
          </Field>
          <Field label={t.common.room}>
            <Select required defaultValue="">
              <option value="" disabled>
                Select available room
              </option>
              {available.map((r) => (
                <option key={r.id} value={r.id}>
                  {t.common.room} {r.number} · {language === "ur" ? r.typeUr : r.type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Purpose of visit">
            <Select defaultValue="leisure">
              <option value="leisure">Leisure</option>
              <option value="business">Business</option>
              <option value="family">Family</option>
            </Select>
          </Field>
          <Field label={t.common.checkIn}>
            <Input type="date" defaultValue="2026-08-22" />
          </Field>
          <Field label={t.common.checkOut}>
            <Input type="date" defaultValue="2026-08-23" />
          </Field>
          <Field label={t.common.adults}>
            <Input type="number" min={1} defaultValue={1} />
          </Field>
          <Field label={t.common.children}>
            <Input type="number" min={0} defaultValue={0} />
          </Field>
          <Field label={t.common.notes} className="md:col-span-2">
            <TextArea placeholder="Allergies, late arrival, special requests…" />
          </Field>
          <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
            <Button type="submit">{t.common.save}</Button>
            <Button type="button" variant="secondary">
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
