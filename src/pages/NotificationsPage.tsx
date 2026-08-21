import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { notifications } from "../data/mock";
import { cn } from "../lib/utils";

const typeTone = {
  info: "info",
  warning: "warning",
  success: "success",
} as const;

export function NotificationsPage() {
  const { t, language } = useApp();

  return (
    <div>
      <PageHeader title={t.pages.notificationsTitle} subtitle={t.pages.notificationsSub} />
      <div className="space-y-3">
        {notifications.map((n) => (
          <Card
            key={n.id}
            className={cn("!p-4", !n.read && "ring-1 ring-[color-mix(in_oklab,var(--accent)_40%,transparent)]")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{language === "ur" ? n.titleUr : n.title}</p>
                  <Badge tone={typeTone[n.type]}>{n.type}</Badge>
                  {!n.read ? <Badge tone="gold">New</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {language === "ur" ? n.bodyUr : n.body}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted">{n.time}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
