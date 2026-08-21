import { useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { PageHeader } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { menuItems } from "../data/mock";
import { formatRs } from "../lib/utils";

export function CounterPage() {
  const { t, language } = useApp();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [source, setSource] = useState<"table" | "takeaway" | "room">("table");

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const item = menuItems.find((m) => m.id === id)!;
          return { item, qty, total: item.price * qty };
        }),
    [cart],
  );

  const total = lines.reduce((sum, l) => sum + l.total, 0);

  function add(id: string) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function dec(id: string) {
    setCart((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) };
      return next;
    });
  }

  return (
    <div>
      <PageHeader title={t.pages.counterTitle} subtitle={t.pages.counterSub} />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Menu board" />
          <div className="mb-4 flex flex-wrap gap-2">
            {(["table", "takeaway", "room"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={source === s ? "gold" : "secondary"}
                onClick={() => setSource(s)}
              >
                {s === "table" ? "Table" : s === "takeaway" ? "Takeaway" : "Room"}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {menuItems
              .filter((m) => m.available)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => add(item.id)}
                  className="rounded-2xl border border-app bg-app p-4 text-start transition hover:border-[var(--accent)] hover:bg-accent-soft"
                >
                  <p className="font-bold">
                    {language === "ur" ? item.nameUr : item.name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {language === "ur" ? item.categoryUr : item.category}
                  </p>
                  <p className="mt-3 text-sm font-extrabold text-[var(--accent)]">
                    {formatRs(item.price, t.common.rs)}
                  </p>
                </button>
              ))}
          </div>
        </Card>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader
            title="Current ticket"
            badge={<Badge tone="gold">#{218}</Badge>}
          />
          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Tap items to build an order.</p>
          ) : (
            <ul className="space-y-3">
              {lines.map(({ item, qty, total: lineTotal }) => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {language === "ur" ? item.nameUr : item.name}
                    </p>
                    <p className="text-xs text-muted">{formatRs(item.price, t.common.rs)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => dec(item.id)}>
                      −
                    </Button>
                    <span className="w-5 text-center text-sm font-bold">{qty}</span>
                    <Button size="sm" variant="ghost" onClick={() => add(item.id)}>
                      +
                    </Button>
                    <span className="w-20 text-end text-sm font-bold">
                      {formatRs(lineTotal, t.common.rs)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 border-t border-app pt-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{t.common.total}</span>
              <span className="text-xl font-extrabold">{formatRs(total, t.common.rs)}</span>
            </div>
            <Button className="mt-4 w-full" disabled={lines.length === 0}>
              Charge & send to kitchen
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
