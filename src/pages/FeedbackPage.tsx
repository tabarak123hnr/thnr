import { Eye, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import { EmptyState, PageHeader, StatCard } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import {
  deleteFeedback,
  subscribeFeedback,
  updateFeedbackStatus,
  type FeedbackStatus,
  type GuestFeedback,
} from "../services/feedback";
import { cn } from "../lib/utils";

function formatWhen(value: unknown) {
  if (!value) return "—";
  let ms = 0;
  if (typeof value === "object" && value && "toMillis" in value) {
    ms = (value as { toMillis: () => number }).toMillis();
  } else if (typeof value === "string" || typeof value === "number") {
    ms = new Date(value).getTime();
  }
  if (!ms || Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= rating ? "fill-[var(--accent)] text-[var(--accent)]" : "text-muted opacity-40",
          )}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

const statusTone: Record<FeedbackStatus, "gold" | "success" | "muted"> = {
  new: "gold",
  reviewed: "success",
  archived: "muted",
};

export function FeedbackPage() {
  const { t } = useApp();
  const f = t.feedback;
  const { success: toastSuccess, error: toastError } = useToast();

  const [rows, setRows] = useState<GuestFeedback[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | FeedbackStatus>("all");
  const [view, setView] = useState<GuestFeedback | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => subscribeFeedback(setRows), []);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const unread = rows.filter((r) => r.status === "new").length;
    const avg =
      total === 0
        ? 0
        : Math.round((rows.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10;
    return { total, unread, avg };
  }, [rows]);

  async function setStatus(row: GuestFeedback, status: FeedbackStatus) {
    setActingId(row.id);
    try {
      await updateFeedbackStatus(row.id, status);
      toastSuccess(f.statusUpdated);
      if (view?.id === row.id) setView({ ...row, status });
    } catch (err) {
      toastError(f.updateFailed, err instanceof Error ? err.message : undefined);
    } finally {
      setActingId(null);
    }
  }

  async function onDelete(row: GuestFeedback) {
    if (!window.confirm(f.deleteConfirm)) return;
    setActingId(row.id);
    try {
      await deleteFeedback(row.id);
      toastSuccess(f.deleted);
      if (view?.id === row.id) setView(null);
    } catch (err) {
      toastError(f.deleteFailed, err instanceof Error ? err.message : undefined);
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={f.inboxTitle}
        subtitle={f.inboxSub}
        actions={
          <div className="min-w-[9rem] w-full sm:w-40">
            <FancySelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { value: "all", label: t.common.all },
                { value: "new", label: f.statusNew },
                { value: "reviewed", label: f.statusReviewed },
                { value: "archived", label: f.statusArchived },
              ]}
            />
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label={f.totalFeedback} value={String(stats.total)} />
        <StatCard
          label={f.newFeedback}
          value={String(stats.unread)}
          alert={stats.unread || undefined}
        />
        <StatCard
          label={f.avgRating}
          value={stats.total ? `${stats.avg} / 5` : "—"}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState message={f.empty} />
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((row) => (
            <Card key={row.id} className="!p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-extrabold">{row.guestName}</p>
                    <Badge tone={statusTone[row.status]}>
                      {row.status === "new"
                        ? f.statusNew
                        : row.status === "reviewed"
                          ? f.statusReviewed
                          : f.statusArchived}
                    </Badge>
                    <Badge tone="info">{f.categories[row.category]}</Badge>
                    <Stars rating={row.rating} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatWhen(row.createdAt)}
                    {row.roomNumber ? ` · ${t.common.room} ${row.roomNumber}` : ""}
                    {row.phone ? ` · ${row.phone}` : ""}
                    {row.email ? ` · ${row.email}` : ""}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm">{row.message}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500"
                    icon={<Eye className="h-3.5 w-3.5" />}
                    onClick={() => setView(row)}
                  >
                    {f.view}
                  </Button>
                  {row.status === "new" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      className="cursor-pointer"
                      disabled={actingId === row.id}
                      onClick={() => void setStatus(row, "reviewed")}
                    >
                      {f.markReviewed}
                    </Button>
                  ) : null}
                  {row.status !== "archived" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="cursor-pointer"
                      disabled={actingId === row.id}
                      onClick={() => void setStatus(row, "archived")}
                    >
                      {f.archive}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer text-red-600"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    disabled={actingId === row.id}
                    onClick={() => void onDelete(row)}
                  >
                    {t.common.delete}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(view)}
        onClose={() => setView(null)}
        title={f.detailTitle}
        subtitle={view ? formatWhen(view.createdAt) : undefined}
        footer={
          view ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setView(null)}>
                {t.common.cancel}
              </Button>
              {view.status === "new" ? (
                <Button
                  type="button"
                  variant="gold"
                  disabled={actingId === view.id}
                  onClick={() => void setStatus(view, "reviewed")}
                >
                  {f.markReviewed}
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {view ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Stars rating={view.rating} />
              <Badge tone={statusTone[view.status]}>
                {view.status === "new"
                  ? f.statusNew
                  : view.status === "reviewed"
                    ? f.statusReviewed
                    : f.statusArchived}
              </Badge>
              <Badge tone="info">{f.categories[view.category]}</Badge>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-muted">{t.common.name}</dt>
                <dd className="font-semibold">{view.guestName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">{t.common.room}</dt>
                <dd className="font-semibold">{view.roomNumber || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">{t.common.phone}</dt>
                <dd className="font-semibold">{view.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">{t.common.email}</dt>
                <dd className="font-semibold break-all">{view.email || "—"}</dd>
              </div>
            </dl>
            <div>
              <p className="text-xs font-semibold text-muted">{f.message}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{view.message}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
