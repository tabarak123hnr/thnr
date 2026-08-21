import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Field, Input, PageHeader, Select } from "../components/ui/Page";
import { useApp } from "../context/app-context";

export function SettingsPage() {
  const { t, theme, toggleTheme, language, setLanguage } = useApp();

  return (
    <div>
      <PageHeader
        title={t.pages.settingsTitle}
        subtitle={t.pages.settingsSub}
        actions={<Button>{t.common.save}</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Property" />
          <div className="space-y-4">
            <Field label="Business name">
              <Input defaultValue="Tabarak Hotel & Restaurant" />
            </Field>
            <Field label="City">
              <Input defaultValue="Lahore" />
            </Field>
            <Field label="Currency">
              <Select defaultValue="PKR">
                <option value="PKR">PKR (Rs)</option>
                <option value="USD">USD</option>
              </Select>
            </Field>
            <Field label="Tax rate (%)">
              <Input type="number" defaultValue={0} />
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Appearance & language" />
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-app px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Theme</p>
                <p className="text-xs text-muted">
                  {theme === "light" ? t.lightMode : t.darkMode}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={toggleTheme}>
                Toggle
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-app px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Language</p>
                <p className="text-xs text-muted">{language === "en" ? "English" : "اردو"}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLanguage(language === "en" ? "ur" : "en")}
              >
                Switch
              </Button>
            </div>
            <Field label="Checkout time">
              <Input type="time" defaultValue="12:00" />
            </Field>
            <Field label="Night audit time">
              <Input type="time" defaultValue="00:30" />
            </Field>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Operations" />
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Default room rate">
              <Input type="number" defaultValue={6500} />
            </Field>
            <Field label="Kitchen printer">
              <Select defaultValue="kitchen-1">
                <option value="kitchen-1">Kitchen · Main</option>
                <option value="kitchen-2">Kitchen · Backup</option>
              </Select>
            </Field>
            <Field label="Backup schedule">
              <Select defaultValue="nightly">
                <option value="nightly">Nightly</option>
                <option value="hourly">Hourly</option>
              </Select>
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
