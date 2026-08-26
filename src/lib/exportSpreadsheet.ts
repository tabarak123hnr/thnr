/** Spreadsheet helpers — CSV opens cleanly in Excel / Google Sheets. */

export type SpreadsheetColumn<T> = {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
};

function escapeCsvCell(value: string | number | boolean | null | undefined) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<T>(rows: T[], columns: SpreadsheetColumn<T>[]) {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.value(row))).join(","),
  );
  return [header, ...lines].join("\r\n");
}

/** UTF-8 BOM so Excel on Windows detects encoding correctly. */
export function downloadCsv(filename: string, csvContent: string) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/**
 * Minimal Excel XML spreadsheet (.xls) — opens in Excel / LibreOffice
 * without an extra library. Prefer CSV for large sheets.
 */
export function downloadExcelXml<T>(
  filename: string,
  sheetName: string,
  rows: T[],
  columns: SpreadsheetColumn<T>[],
) {
  const escapeXml = (v: string) =>
    v
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const headerCells = columns
    .map(
      (c) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(c.header)}</Data></Cell>`,
    )
    .join("");

  const body = rows
    .map((row) => {
      const cells = columns
        .map((c) => {
          const raw = c.value(row);
          if (typeof raw === "number" && Number.isFinite(raw)) {
            return `<Cell><Data ss:Type="Number">${raw}</Data></Cell>`;
          }
          return `<Cell><Data ss:Type="String">${escapeXml(String(raw ?? ""))}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}">
  <Table>
   <Row>${headerCells}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const name = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  triggerDownload(blob, name);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
