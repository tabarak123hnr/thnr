import { Download, Eye, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Modal } from "../components/ui/Modal";
import {
  EmptyState,
  Field,
  Input,
  PageHeader,
  StatCard,
  TextArea,
} from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import { menuItems as sampleMenu } from "../data/mock";
import { downloadCsv, downloadExcelXml, toCsv } from "../lib/exportSpreadsheet";
import { MENU_IMPORT_HEADERS, parseMenuSpreadsheet } from "../lib/menuImport";
import { formatRs } from "../lib/utils";
import {
  createMenuItem,
  deleteMenuItem,
  importMenuItems,
  MENU_CATEGORIES,
  seedMenuIfEmpty,
  setMenuItemAvailable,
  subscribeMenuItems,
  updateMenuItem,
  type MenuItem,
} from "../services/menu";

const emptyForm = () => ({
  name: "",
  nameUr: "",
  category: MENU_CATEGORIES[0].value,
  price: "",
  prepMinutes: "15",
  available: true,
  description: "",
});

export function MenuPage() {
  const { t, language } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availFilter, setAvailFilter] = useState<"all" | "available" | "unavailable">(
    "all",
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewRow, setViewRow] = useState<MenuItem | null>(null);
  const [deleteRow, setDeleteRow] = useState<MenuItem | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<
    Awaited<ReturnType<typeof parseMenuSpreadsheet>>
  >([]);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeMenuItems(setItems);
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (availFilter === "available" && !item.available) return false;
      if (availFilter === "unavailable" && item.available) return false;
      return true;
    });
  }, [items, categoryFilter, availFilter]);

  const availableCount = items.filter((i) => i.available).length;

  const categoryOptions = useMemo(
    () =>
      MENU_CATEGORIES.map((c) => ({
        value: c.value,
        label: language === "ur" ? c.labelUr : c.label,
      })),
    [language],
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(row: MenuItem) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      nameUr: row.nameUr,
      category: row.category || MENU_CATEGORIES[0].value,
      price: String(row.price),
      prepMinutes: String(row.prepMinutes),
      available: row.available,
      description: row.description || "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function onSave() {
    setFormError(null);
    const price = Number(form.price);
    if (!form.name.trim()) {
      setFormError("Dish name is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError("Enter a valid price.");
      return;
    }

    const cat = MENU_CATEGORIES.find((c) => c.value === form.category);
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        nameUr: form.nameUr,
        category: form.category,
        categoryUr: cat?.labelUr || "",
        price,
        prepMinutes: Number(form.prepMinutes) || 0,
        available: form.available,
        description: form.description,
      };
      if (editingId) {
        await updateMenuItem(editingId, payload);
        toastSuccess("Menu updated", form.name.trim());
      } else {
        await createMenuItem(payload);
        toastSuccess("Dish added", form.name.trim());
      }
      setFormOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      setFormError(message);
      toastError("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(row: MenuItem) {
    setActingId(row.id);
    try {
      await setMenuItemAvailable(row.id, !row.available);
      toastSuccess(
        row.available ? "Marked unavailable" : "Marked available",
        row.name,
      );
    } catch (err) {
      toastError(
        "Update failed",
        err instanceof Error ? err.message : "Try again.",
      );
    } finally {
      setActingId(null);
    }
  }

  async function onDeleteConfirm() {
    if (!deleteRow) return;
    setActingId(deleteRow.id);
    try {
      await deleteMenuItem(deleteRow.id);
      toastSuccess("Deleted", deleteRow.name);
      setDeleteRow(null);
    } catch (err) {
      toastError(
        "Delete failed",
        err instanceof Error ? err.message : "Try again.",
      );
    } finally {
      setActingId(null);
    }
  }

  function runExport(kind: "csv" | "excel") {
    const columns = [
      { header: "Name", value: (r: MenuItem) => r.name },
      { header: "Name (Urdu)", value: (r: MenuItem) => r.nameUr },
      { header: "Category", value: (r: MenuItem) => r.category },
      { header: "Category (Urdu)", value: (r: MenuItem) => r.categoryUr },
      { header: "Price (Rs)", value: (r: MenuItem) => r.price },
      { header: "Prep (min)", value: (r: MenuItem) => r.prepMinutes },
      {
        header: "Available",
        value: (r: MenuItem) => (r.available ? "Yes" : "No"),
      },
      { header: "Description", value: (r: MenuItem) => r.description || "" },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    const rows = filtered.length ? filtered : items;
    if (!rows.length) {
      toastError("Nothing to export", "Add menu items first.");
      return;
    }
    if (kind === "csv") {
      downloadCsv(`tabarak-menu-${stamp}.csv`, toCsv(rows, columns));
    } else {
      downloadExcelXml(`tabarak-menu-${stamp}`, "Menu", rows, columns);
    }
    setExportOpen(false);
    toastSuccess(
      "Exported",
      kind === "csv" ? "CSV downloaded (opens in Excel)." : "Excel file downloaded.",
    );
  }

  async function onPickImportFile(file: File | null) {
    setImportError(null);
    setImportPreview([]);
    setImportFileName(null);
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!/\.(csv|xlsx|xls)$/.test(lower)) {
      setImportError("Use a .csv, .xlsx, or .xls file.");
      return;
    }

    try {
      const rows = await parseMenuSpreadsheet(file);
      setImportPreview(rows);
      setImportFileName(file.name);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not read file.");
    }
  }

  async function onConfirmImport() {
    if (!importPreview.length) {
      setImportError("Choose a file with dishes first.");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const result = await importMenuItems(importPreview);
      if (result.imported > 0) {
        toastSuccess(
          "Menu imported",
          `${result.imported} dish${result.imported === 1 ? "" : "es"} added` +
            (result.failed ? ` · ${result.failed} skipped` : ""),
        );
      } else {
        toastError(
          "Nothing imported",
          result.errors[0] || "No dishes were saved.",
        );
      }
      if (result.failed && result.errors.length) {
        setImportError(result.errors.slice(0, 5).join(" · "));
      } else {
        setImportOpen(false);
        setImportPreview([]);
        setImportFileName(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed.";
      setImportError(message);
      toastError("Import failed", message);
    } finally {
      setImporting(false);
    }
  }

  async function onSeedSamples() {
    setSeeding(true);
    try {
      const result = await seedMenuIfEmpty(
        sampleMenu.map((m) => ({
          name: m.name,
          nameUr: m.nameUr,
          category: m.category,
          categoryUr: m.categoryUr,
          price: m.price,
          available: m.available,
          prepMinutes: m.prepMinutes,
        })),
      );
      if (result.seeded) {
        toastSuccess("Sample menu loaded", `${result.count} dishes added.`);
      } else {
        toastSuccess("Menu already has items", `${result.count} dishes on file.`);
      }
    } catch (err) {
      toastError(
        "Seed failed",
        err instanceof Error ? err.message : "Try again.",
      );
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.menuTitle}
        subtitle={t.pages.menuSub}
        actions={
          <>
            <Button
              variant="secondary"
              className="cursor-pointer"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => {
                setImportError(null);
                setImportPreview([]);
                setImportFileName(null);
                setImportOpen(true);
              }}
            >
              Import
            </Button>
            <Button
              variant="secondary"
              className="cursor-pointer"
              icon={<Download className="h-4 w-4" />}
              onClick={() => setExportOpen(true)}
            >
              {t.common.export}
            </Button>
            <Button className="cursor-pointer" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              {t.common.add} item
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Dishes" value={String(items.length)} />
        <StatCard label="Available" value={String(availableCount)} />
        <StatCard
          label="Unavailable"
          value={String(items.length - availableCount)}
          hint="Off the menu"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={categoryFilter === "all" ? "primary" : "secondary"}
          onClick={() => setCategoryFilter("all")}
        >
          All categories
        </Button>
        {MENU_CATEGORIES.map((c) => (
          <Button
            key={c.value}
            size="sm"
            variant={categoryFilter === c.value ? "primary" : "secondary"}
            onClick={() => setCategoryFilter(c.value)}
          >
            {language === "ur" ? c.labelUr : c.label}
          </Button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["available", "Available"],
            ["unavailable", "Unavailable"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={availFilter === value ? "primary" : "secondary"}
            onClick={() => setAvailFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <div className="space-y-3 p-2">
            <EmptyState
              message={
                items.length === 0
                  ? "No menu items yet. Add a dish or load the sample menu."
                  : "No dishes match these filters."
              }
            />
            {items.length === 0 ? (
              <div className="flex justify-center pb-4">
                <Button
                  variant="secondary"
                  disabled={seeding}
                  onClick={() => void onSeedSamples()}
                >
                  {seeding ? "Loading…" : "Load sample menu"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <Table
            headers={[
              t.common.name,
              "Category",
              t.common.amount,
              "Prep",
              t.status,
              t.common.actions,
            ]}
          >
            {filtered.map((item) => (
              <Tr key={item.id}>
                <Td className="font-semibold">
                  {language === "ur" && item.nameUr ? item.nameUr : item.name}
                  {language !== "ur" && item.nameUr ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted">
                      {item.nameUr}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone="muted">
                    {language === "ur" && item.categoryUr
                      ? item.categoryUr
                      : item.category}
                  </Badge>
                </Td>
                <Td className="font-bold">{formatRs(item.price, t.common.rs)}</Td>
                <Td className="text-muted">{item.prepMinutes}m</Td>
                <Td>
                  <Badge tone={item.available ? "success" : "danger"}>
                    {item.available ? "Available" : "Unavailable"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500"
                      icon={<Eye className="h-3.5 w-3.5" />}
                      onClick={() => setViewRow(item)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="gold"
                      className="cursor-pointer"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => openEdit(item)}
                    >
                      {t.common.edit}
                    </Button>
                    <Button
                      size="sm"
                      className="cursor-pointer !bg-[var(--text)] !text-[var(--bg-elevated)] hover:!brightness-125"
                      disabled={actingId === item.id}
                      onClick={() => void onToggle(item)}
                    >
                      {item.available ? "Mark unavailable" : "Mark available"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="cursor-pointer"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => setDeleteRow(item)}
                    >
                      {t.common.delete}
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editingId ? "Edit dish" : "Add dish"}
        subtitle="Shown on Orders when available."
        wide
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button disabled={saving} onClick={() => void onSave()}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add dish"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {formError ? (
            <p className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}
          <Field label="Name (English)">
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Chicken Karahi"
              required
            />
          </Field>
          <Field label="Name (Urdu)">
            <Input
              value={form.nameUr}
              onChange={(e) => setForm((p) => ({ ...p, nameUr: e.target.value }))}
              placeholder="چکن کڑاہی"
            />
          </Field>
          <SelectField label="Category">
            <FancySelect
              value={form.category}
              onChange={(category) => setForm((p) => ({ ...p, category }))}
              options={categoryOptions}
            />
          </SelectField>
          <Field label={`Price (${t.common.rs})`}>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
            />
          </Field>
          <Field label="Prep time (minutes)">
            <Input
              type="number"
              min={0}
              value={form.prepMinutes}
              onChange={(e) => setForm((p) => ({ ...p, prepMinutes: e.target.value }))}
            />
          </Field>
          <SelectField label="Availability">
            <FancySelect
              value={form.available ? "yes" : "no"}
              onChange={(v) => setForm((p) => ({ ...p, available: v === "yes" }))}
              options={[
                { value: "yes", label: "Available" },
                { value: "no", label: "Unavailable" },
              ]}
            />
          </SelectField>
          <Field label="Description (optional)" className="sm:col-span-2">
            <TextArea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Half portion, spicy…"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title={viewRow ? (language === "ur" && viewRow.nameUr ? viewRow.nameUr : viewRow.name) : "Dish"}
        footer={
          <Button variant="secondary" onClick={() => setViewRow(null)}>
            Close
          </Button>
        }
      >
        {viewRow ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Detail label="English" value={viewRow.name} />
              <Detail label="Urdu" value={viewRow.nameUr || "—"} />
              <Detail label="Category" value={viewRow.category} />
              <Detail label="Price" value={formatRs(viewRow.price, t.common.rs)} />
              <Detail label="Prep" value={`${viewRow.prepMinutes} min`} />
              <Detail
                label="Status"
                value={viewRow.available ? "Available" : "Unavailable"}
              />
            </div>
            {viewRow.description ? (
              <p className="rounded-xl bg-app px-3 py-2 text-sm text-muted">
                {viewRow.description}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteRow)}
        onClose={() => setDeleteRow(null)}
        title="Delete dish?"
        subtitle={deleteRow ? deleteRow.name : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={actingId === deleteRow?.id}
              onClick={() => void onDeleteConfirm()}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Existing orders keep their saved line items; new orders won’t show this dish.
        </p>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => !importing && setImportOpen(false)}
        title="Import menu"
        subtitle="Upload CSV or Excel — same columns as Export."
        wide
        footer={
          <>
            <Button
              variant="secondary"
              disabled={importing}
              onClick={() => setImportOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer !bg-[var(--text)] !text-[var(--bg-elevated)] hover:!brightness-125"
              disabled={importing || !importPreview.length}
              icon={<Upload className="h-4 w-4" />}
              onClick={() => void onConfirmImport()}
            >
              {importing
                ? "Importing…"
                : importPreview.length
                  ? `Import ${importPreview.length} dishes`
                  : "Import dishes"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {importError ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {importError}
            </p>
          ) : null}

          <input
            ref={importFileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              void onPickImportFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-app bg-app px-4 py-8 text-sm transition hover:border-[var(--accent)] hover:bg-accent-soft"
          >
            <Upload className="h-6 w-6 text-[var(--accent)] opacity-80" />
            <span className="font-semibold">
              {importFileName ? importFileName : "Choose CSV or Excel file"}
            </span>
            <span className="text-xs text-muted">.csv · .xlsx · .xls</span>
          </button>

          <p className="rounded-xl bg-app px-3 py-2 text-xs text-muted break-all">
            Expected headers: {MENU_IMPORT_HEADERS}
          </p>

          {importPreview.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Preview ({importPreview.length})
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {importPreview.slice(0, 40).map((row, i) => (
                  <li
                    key={`${row.name}-${i}`}
                    className="flex justify-between gap-2 rounded-lg bg-app px-3 py-2"
                  >
                    <span className="min-w-0 truncate font-semibold">
                      {row.name}
                      <span className="ms-2 text-xs font-normal text-muted">
                        {row.category}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold">
                      {formatRs(row.price, t.common.rs)}
                    </span>
                  </li>
                ))}
              </ul>
              {importPreview.length > 40 ? (
                <p className="mt-2 text-xs text-muted">
                  +{importPreview.length - 40} more will import too.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export menu"
        subtitle="Download the current list (respects filters) for Excel or Sheets."
        footer={
          <Button variant="secondary" onClick={() => setExportOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500"
            icon={<Download className="h-4 w-4" />}
            onClick={() => runExport("csv")}
          >
            CSV (Excel / Sheets)
          </Button>
          <Button
            variant="gold"
            className="cursor-pointer"
            icon={<Download className="h-4 w-4" />}
            onClick={() => runExport("excel")}
          >
            Excel (.xls)
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          CSV is best for Google Sheets and Excel. Excel (.xls) opens directly in Microsoft Excel.
        </p>
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-app px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-semibold break-all">{value}</p>
    </div>
  );
}
