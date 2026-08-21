import { useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, Input, PageHeader, Select, TextArea } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { rooms as initialRooms } from "../data/mock";
import { cn, formatRs } from "../lib/utils";
import type { Room, RoomStatus } from "../types";

const statusTone: Record<RoomStatus, "success" | "warning" | "gold" | "danger" | "info"> = {
  available: "success",
  occupied: "gold",
  cleaning: "warning",
  maintenance: "danger",
  reserved: "info",
};

export function RoomsPage() {
  const { t, language } = useApp();
  const [rooms] = useState(initialRooms);
  const [selectedId, setSelectedId] = useState(rooms.find((r) => r.status === "occupied")?.id ?? rooms[0].id);
  const [filter, setFilter] = useState<"all" | RoomStatus>("all");

  const filtered = useMemo(
    () => (filter === "all" ? rooms : rooms.filter((r) => r.status === filter)),
    [filter, rooms],
  );

  const selected = rooms.find((r) => r.id === selectedId) as Room;

  return (
    <div>
      <PageHeader
        title={t.pages.roomsTitle}
        subtitle={t.pages.roomsSub}
        actions={
          <>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="w-40"
            >
              <option value="all">{t.common.all}</option>
              {(Object.keys(t.roomStatus) as RoomStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t.roomStatus[s]}
                </option>
              ))}
            </Select>
            <Button>{t.newCheckIn}</Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setSelectedId(room.id)}
              className={cn(
                "surface rounded-2xl p-4 text-start transition hover:ring-2 ring-accent",
                selectedId === room.id && "ring-2 ring-[var(--accent)]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-muted">
                    {t.common.floor} {room.floor}
                  </p>
                  <p className="mt-0.5 text-xl font-extrabold">
                    {t.common.room} {room.number}
                  </p>
                </div>
                <Badge tone={statusTone[room.status]}>{t.roomStatus[room.status]}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">
                {language === "ur" ? room.typeUr : room.type}
              </p>
              {room.guest ? (
                <p className="mt-3 truncate text-sm font-semibold">
                  {language === "ur" && room.guest.nameUr ? room.guest.nameUr : room.guest.name}
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted">—</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {room.dirty ? <Badge tone="warning">Dirty</Badge> : <Badge tone="success">Clean</Badge>}
                {room.openOrders > 0 ? (
                  <Badge tone="info">
                    {room.openOrders} order{room.openOrders > 1 ? "s" : ""}
                  </Badge>
                ) : null}
              </div>
            </button>
          ))}
        </div>

        <Card className="h-fit xl:sticky xl:top-20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t.common.room} {selected.number}
              </p>
              <h2 className="text-lg font-extrabold">
                {language === "ur" ? selected.typeUr : selected.type}
              </h2>
            </div>
            <Badge tone={statusTone[selected.status]}>{t.roomStatus[selected.status]}</Badge>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-app p-3">
              <p className="text-xs text-muted">{t.common.rate}</p>
              <p className="mt-1 font-bold">{formatRs(selected.rate, t.common.rs)}</p>
            </div>
            <div className="rounded-xl bg-app p-3">
              <p className="text-xs text-muted">Open orders</p>
              <p className="mt-1 font-bold">{selected.openOrders}</p>
            </div>
          </div>

          {selected.guest ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Guest info</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t.common.name}>
                  <Input
                    readOnly
                    value={
                      language === "ur" && selected.guest.nameUr
                        ? selected.guest.nameUr
                        : selected.guest.name
                    }
                  />
                </Field>
                <Field label={t.common.phone}>
                  <Input readOnly value={selected.guest.phone} />
                </Field>
                <Field label={t.common.cnic}>
                  <Input readOnly value={selected.guest.cnic} />
                </Field>
                <Field label={t.common.nationality}>
                  <Input readOnly value={selected.guest.nationality} />
                </Field>
                <Field label={t.common.checkIn}>
                  <Input readOnly value={selected.guest.checkIn} />
                </Field>
                <Field label={t.common.checkOut}>
                  <Input readOnly value={selected.guest.checkOut} />
                </Field>
                <Field label={t.common.adults}>
                  <Input readOnly value={selected.guest.adults} />
                </Field>
                <Field label={t.common.children}>
                  <Input readOnly value={selected.guest.children} />
                </Field>
              </div>
              <Field label={t.common.notes}>
                <TextArea readOnly value={selected.guest.notes ?? ""} rows={2} />
              </Field>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-app p-6 text-center text-sm text-muted">
              No guest assigned. Use Check-in to fill this room.
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" variant="gold">
              Add room order
            </Button>
            <Button size="sm" variant="secondary">
              Mark cleaning
            </Button>
            <Button size="sm" variant="ghost">
              Checkout
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
