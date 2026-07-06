import * as XLSX from "xlsx";

import type { EventGuestRow } from "@/lib/api";

export interface GuestImportRow {
  full_name: string;
  email: string;
  phone: string;
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (Number.isInteger(value) && Math.abs(value) >= 1e9) {
      return String(Math.trunc(value));
    }
    return String(value);
  }
  return String(value).trim();
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function headerKey(value: string): keyof GuestImportRow | null {
  const h = normalizeHeader(value);
  if (!h) return null;
  if (h.includes("اسم") || h === "name" || h === "full_name" || h === "fullname") {
    return "full_name";
  }
  if (h.includes("بريد") || h === "email" || h.includes("e-mail")) {
    return "email";
  }
  if (
    h.includes("جوال") ||
    h.includes("هاتف") ||
    h === "phone" ||
    h.includes("mobile") ||
    h.includes("whatsapp")
  ) {
    return "phone";
  }
  return null;
}

function buildColumnIndex(headers: string[]): Partial<Record<keyof GuestImportRow, number>> {
  const index: Partial<Record<keyof GuestImportRow, number>> = {};
  headers.forEach((header, i) => {
    const key = headerKey(header);
    if (key != null && index[key] == null) {
      index[key] = i;
    }
  });
  return index;
}

function rowFromIndexed(
  row: unknown[],
  index: Partial<Record<keyof GuestImportRow, number>>
): GuestImportRow | null {
  const full_name = cellStr(
    index.full_name != null ? row[index.full_name] : row[0]
  );
  if (!full_name) return null;
  return {
    full_name,
    email: cellStr(index.email != null ? row[index.email] : row[1]),
    phone: cellStr(index.phone != null ? row[index.phone] : row[2]),
  };
}

export async function parseGuestExcelFile(file: File): Promise<GuestImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  if (!matrix.length) return [];

  const firstRow = matrix[0].map((cell) => cellStr(cell));
  const hasHeader = firstRow.some((cell) => headerKey(cell) != null);
  const colIndex = hasHeader ? buildColumnIndex(firstRow) : {};
  const dataRows = hasHeader ? matrix.slice(1) : matrix;

  return dataRows
    .map((row) => {
      const cells = Array.isArray(row) ? row : [];
      return rowFromIndexed(cells, colIndex);
    })
    .filter((row): row is GuestImportRow => row != null);
}

export function exportGuestsExcel(rows: EventGuestRow[], filename: string) {
  const data = rows.map((guest) => ({
    الاسم: guest.full_name,
    البريد: guest.email || "",
    الجوال: guest.phone || "",
    المناسبة: guest.event_title || "",
    القسم: guest.section_name || "",
    المجموعة: guest.group_name || "",
    الحالة: guest.status_label || "",
  }));

  const sheet = XLSX.utils.json_to_sheet(data);
  sheet["!cols"] = [
    { wch: 28 },
    { wch: 28 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "الضيوف");
  const outName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, outName);
}

export function downloadGuestImportTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["الاسم", "البريد", "الجوال"],
    ["أحمد محمد", "ahmed@example.com", "966501234567"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "نموذج");
  XLSX.writeFile(workbook, "guests-import-template.xlsx");
}
