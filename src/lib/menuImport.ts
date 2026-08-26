import * as XLSX from "xlsx";
import { MENU_CATEGORIES } from "../types/menu";

export type MenuImportRow = {
  name: string;
  nameUr: string;
  category: string;
  categoryUr: string;
  price: number;
  prepMinutes: number;
  available: boolean;
  description: string;
};

function normKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .replace(/\(.*?\)/g, "")
    .trim();
}

function pick(
  row: Record<string, unknown>,
  aliases: string[],
): string {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normKey(k), v);
  }
  for (const alias of aliases) {
    const v = map.get(normKey(alias));
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function parseAvailable(raw: string) {
  const s = raw.trim().toLowerCase();
  if (!s) return true;
  if (["no", "n", "false", "0", "unavailable", "off"].includes(s)) return false;
  return true;
}

function parsePrice(raw: string) {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function resolveCategory(name: string, nameUrHint: string) {
  const found = MENU_CATEGORIES.find(
    (c) =>
      c.value.toLowerCase() === name.toLowerCase() ||
      c.label.toLowerCase() === name.toLowerCase() ||
      c.labelUr === name,
  );
  if (found) {
    return { category: found.value, categoryUr: nameUrHint || found.labelUr };
  }
  if (name) {
    return { category: name, categoryUr: nameUrHint || name };
  }
  const fallback = MENU_CATEGORIES[0];
  return { category: fallback.value, categoryUr: nameUrHint || fallback.labelUr };
}

function rowFromObject(obj: Record<string, unknown>): MenuImportRow | null {
  const name = pick(obj, ["name", "dish", "item", "item name", "dish name"]);
  if (!name) return null;

  const nameUr = pick(obj, ["name urdu", "name (urdu)", "nameur", "urdu"]);
  const categoryRaw = pick(obj, ["category", "cat", "type"]);
  const categoryUr = pick(obj, ["category urdu", "category (urdu)", "categoryur"]);
  const priceRaw = pick(obj, ["price", "price rs", "amount", "rate"]);
  const prepRaw = pick(obj, ["prep", "prep min", "prep minutes", "prep time", "minutes"]);
  const availableRaw = pick(obj, ["available", "status", "in stock"]);
  const description = pick(obj, ["description", "notes", "detail"]);

  const price = parsePrice(priceRaw || "0");
  if (!Number.isFinite(price)) return null;

  const { category, categoryUr: catUr } = resolveCategory(categoryRaw || "Other", categoryUr);

  return {
    name,
    nameUr,
    category,
    categoryUr: catUr,
    price,
    prepMinutes: Math.max(0, Math.floor(Number(prepRaw) || 0)),
    available: parseAvailable(availableRaw),
    description,
  };
}

/**
 * Parse .csv / .xlsx / .xls into menu import rows.
 * First sheet is used for Excel files.
 */
export async function parseMenuSpreadsheet(file: File): Promise<MenuImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The file has no sheets.");

  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (!json.length) {
    throw new Error("No data rows found. Add a header row and at least one dish.");
  }

  const rows: MenuImportRow[] = [];

  json.forEach((obj) => {
    const row = rowFromObject(obj);
    if (row) rows.push(row);
  });

  if (!rows.length) {
    throw new Error(
      "No valid dishes found. Need a Name column (and Price). Export a sample file for the correct headers.",
    );
  }

  return rows;
}

export const MENU_IMPORT_HEADERS =
  "Name, Name (Urdu), Category, Category (Urdu), Price (Rs), Prep (min), Available, Description";
