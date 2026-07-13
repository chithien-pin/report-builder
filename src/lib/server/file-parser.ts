import { writeFile, unlink } from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

import Papa from "papaparse";
import * as XLSX from "xlsx";

import { all, run, sqlPath, withConnection } from "@/lib/server/duckdb-client";
import { saveDataset } from "@/lib/server/storage";
import type { ColumnDtype, ColumnInfo, DatasetMeta } from "@/lib/types";

export const PREVIEW_ROWS = 20;

const DATE_COLUMN_HINTS = new Set(["date", "ngay", "ngày", "ngay sinh", "ngày sinh", "time", "created", "updated", "day"]);

const NUMERIC_COLUMN_HINTS = [
  "so luong",
  "số lượng",
  "trong luong",
  "trọng lượng",
  "doanh thu",
  "thanh tien",
  "thành tiền",
  "tien",
  "tiền",
  "don gia",
  "đơn giá",
  "von",
  "vốn",
  "loi nhuan",
  "lợi nhuận",
  "cong ban",
  "quantity",
  "amount",
  "revenue",
  "price",
  "weight",
];

function normalizeColumnName(name: string, index: number): string {
  const cleaned = String(name).trim();
  if (!cleaned || cleaned.toLowerCase().startsWith("unnamed")) {
    return `column_${index + 1}`;
  }
  return cleaned;
}

function excelSerialToDate(serial: number): Date | null {
  // Excel serial: days since 1899-12-30 (serial >= 60 has leap-year bug adjustment)
  if (!Number.isFinite(serial) || serial < 30000 || serial >= 100000) return null;
  const base = Date.UTC(1899, 11, 30);
  const days = serial >= 60 ? serial - 1 : serial;
  return new Date(base + days * 86400000);
}

function isPlausibleDate(d: Date): boolean {
  const y = d.getUTCFullYear();
  return y >= 1900 && y <= 2100;
}

function formatDateValue(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseDateValue(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isPlausibleDate(value) ? value : null;
  }
  if (typeof value === "number") {
    const fromSerial = excelSerialToDate(value);
    return fromSerial && isPlausibleDate(fromSerial) ? fromSerial : null;
  }

  const str = String(value).trim();
  if (!str) return null;

  // xlsx/Excel mangled string: +046203-12 (NEVER use new Date() on this — slice(0,10) = +046203-12)
  const mangled = str.match(/^\+?0*(\d{5,})-\d{2}(?:-\d{2})?$/);
  if (mangled) {
    const d = excelSerialToDate(Number(mangled[1]));
    return d && isPlausibleDate(d) ? d : null;
  }

  const dmy = str.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (dmy) {
    const parsed = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
    return isPlausibleDate(parsed) ? parsed : null;
  }

  const ymd = str.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
  if (ymd) {
    const parsed = new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
    return isPlausibleDate(parsed) ? parsed : null;
  }

  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const d = excelSerialToDate(Number(str));
    return d && isPlausibleDate(d) ? d : null;
  }

  return null;
}

function hasNumericHint(columnName: string): boolean {
  const hint = columnName.toLowerCase();
  return NUMERIC_COLUMN_HINTS.some((token) => hint.includes(token));
}

function hasDateHint(columnName: string): boolean {
  const hint = columnName.toLowerCase();
  return [...DATE_COLUMN_HINTS].some((token) => hint.includes(token));
}

function looksLikeDate(values: unknown[], columnName: string): boolean {
  const sample = values.filter((v) => v != null && String(v).trim() !== "").slice(0, 50);
  if (sample.length === 0) return false;
  const parsed = sample.map(parseDateValue);
  const ratio = parsed.filter(Boolean).length / sample.length;
  if (ratio >= 0.8) return true;
  if (hasDateHint(columnName)) {
    const serialRatio =
      sample.filter((v) => typeof v === "number" || /^\d{5,}(\.\d+)?$/.test(String(v).trim()))
        .length / sample.length;
    return serialRatio >= 0.5;
  }
  return false;
}

function looksLikeNumber(values: unknown[]): boolean {
  const sample = values.filter((v) => v != null && String(v).trim() !== "").slice(0, 50);
  if (sample.length === 0) return false;
  let ok = 0;
  for (const v of sample) {
    const n = Number(String(v).replace(/,/g, "").replace(/\s/g, ""));
    if (!Number.isNaN(n)) ok++;
  }
  return ok / sample.length >= 0.8;
}

function detectDtype(values: unknown[], columnName: string): ColumnDtype {
  // Tên gợi ý số → luôn number (tránh Excel format date làm hỏng SO LUONG, DOANH THU…)
  if (hasNumericHint(columnName)) {
    const sample = values.filter((v) => v != null).slice(0, 50);
    const hasDot = sample.some((v) => {
      if (typeof v === "number") return !Number.isInteger(v);
      return String(v).includes(".");
    });
    return hasDot ? "float" : "number";
  }

  const hinted = hasDateHint(columnName);
  if (hinted && looksLikeDate(values, columnName)) return "date";
  if (looksLikeNumber(values)) {
    const sample = values.filter((v) => v != null).slice(0, 50);
    const hasDot = sample.some((v) => String(v).includes("."));
    return hasDot ? "float" : "number";
  }
  if (!hinted && looksLikeDate(values, columnName)) return "date";
  return "string";
}

function excelDateToSerial(value: Date): number {
  // Đảo ngược cách xlsx/Excel map serial → Date (gốc 1899-12-30 + leap bug)
  const excelEpoch = Date.UTC(1899, 11, 30);
  let serial = (value.getTime() - excelEpoch) / 86400000;
  if (serial >= 60) serial += 1;
  return serial;
}

function coerceValue(value: unknown, dtype: ColumnDtype): unknown {
  if (value == null || value === "") return null;
  if (dtype === "date") {
    const d = parseDateValue(value);
    return d ? formatDateValue(d) : null;
  }
  if (dtype === "number" || dtype === "float") {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    // Excel format date nhầm trên ô số → khôi phục serial (1, 1.3, doanh thu…)
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const serial = excelDateToSerial(value);
      return Number.isFinite(serial) ? serial : null;
    }
    const n = Number(String(value).replace(/,/g, "").replace(/\s/g, "").replace(/%/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  if (dtype === "boolean") {
    const s = String(value).toLowerCase();
    if (["true", "1", "yes"].includes(s)) return true;
    if (["false", "0", "no"].includes(s)) return false;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateValue(value);
  }
  return String(value);
}

type ParsedFrame = {
  rows: Record<string, unknown>[];
  columns: ColumnInfo[];
  originalColumns: string[];
};

function buildFrame(rawRows: Record<string, unknown>[], originalColumns: string[]): ParsedFrame {
  if (rawRows.length === 0) {
    const cols = originalColumns.map((name, i) => ({
      name: normalizeColumnName(name, i),
      dtype: "string" as ColumnDtype,
      original_name: String(name).trim() || normalizeColumnName(name, i),
    }));
    return { rows: [], columns: cols, originalColumns };
  }

  const keys = Object.keys(rawRows[0]);
  const normalized = keys.map((k, i) => normalizeColumnName(k, i));
  const columns: ColumnInfo[] = normalized.map((name, i) => {
    const colValues = rawRows.map((r) => r[keys[i]]);
    const original = originalColumns[i] ?? keys[i];
    return {
      name,
      dtype: detectDtype(colValues, name),
      original_name: String(original).trim() || name,
    };
  });

  const rows = rawRows.map((row) => {
    const out: Record<string, unknown> = {};
    keys.forEach((key, i) => {
      out[normalized[i]] = coerceValue(row[key], columns[i].dtype);
    });
    return out;
  });

  return { rows, columns, originalColumns: originalColumns.length ? originalColumns : keys };
}

function previewRecords(rows: Record<string, unknown>[], limit = PREVIEW_ROWS) {
  return rows.slice(0, limit).map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = v ?? null;
    }
    return out;
  });
}

async function rowsToParquetBuffer(rows: Record<string, unknown>[]): Promise<Buffer> {
  const tmpJson = path.join(os.tmpdir(), `reportbtmh-${randomUUID()}.json`);
  const tmpParquet = path.join(os.tmpdir(), `reportbtmh-${randomUUID()}.parquet`);

  await writeFile(tmpJson, JSON.stringify(rows), "utf-8");

  try {
    await withConnection(async (conn) => {
      await run(
        conn,
        `COPY (SELECT * FROM read_json_auto('${sqlPath(tmpJson)}')) TO '${sqlPath(tmpParquet)}' (FORMAT PARQUET)`,
      );
    });
    const { readFile } = await import("fs/promises");
    return await readFile(tmpParquet);
  } finally {
    await unlink(tmpJson).catch(() => {});
    await unlink(tmpParquet).catch(() => {});
  }
}

export function readCsvText(text: string): Record<string, unknown>[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "CSV parse error");
  }
  return parsed.data;
}

export function readUploadedBuffer(
  content: Buffer,
  filename: string,
  sheet?: string | null,
): { rows: Record<string, unknown>[]; sheet: string | null; originalColumns: string[] } {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".csv")) {
    const text = content.toString("utf-8");
    const rows = readCsvText(text);
    const originalColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, sheet: null, originalColumns };
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    // cellDates:false — giữ serial/number thô, tránh ô số bị biến thành Date rồi mất khi coerce
    const wb = XLSX.read(content, { type: "buffer", cellDates: false });
    const sheetName = sheet && wb.SheetNames.includes(sheet) ? sheet : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: true,
    });
    const originalColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, sheet: sheetName, originalColumns };
  }

  throw new Error("Unsupported file type. Use CSV or XLSX.");
}

export async function ingestRows(
  rawRows: Record<string, unknown>[],
  filename: string,
  sheet: string | null = null,
  originalColumns: string[] = [],
): Promise<{ datasetId: string; meta: DatasetMeta; preview: Record<string, unknown>[] }> {
  const frame = buildFrame(rawRows, originalColumns);
  const datasetId = randomUUID();

  const meta: DatasetMeta = {
    dataset_id: datasetId,
    filename,
    row_count: frame.rows.length,
    column_count: frame.columns.length,
    columns: frame.columns,
    created_at: new Date().toISOString(),
    sheet,
  };

  const parquetBuffer = await rowsToParquetBuffer(frame.rows);
  await saveDataset(datasetId, parquetBuffer, meta);

  return {
    datasetId,
    meta,
    preview: previewRecords(frame.rows),
  };
}

export async function ingestBytes(
  content: Buffer,
  filename: string,
  sheet?: string | null,
): Promise<{ datasetId: string; meta: DatasetMeta; preview: Record<string, unknown>[] }> {
  const { rows, sheet: usedSheet, originalColumns } = readUploadedBuffer(content, filename, sheet);
  return ingestRows(rows, filename, usedSheet, originalColumns);
}

export async function ingestCsvText(
  text: string,
  filename = "google_sheet.csv",
): Promise<{ datasetId: string; meta: DatasetMeta; preview: Record<string, unknown>[] }> {
  const rows = readCsvText(text);
  const originalColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return ingestRows(rows, filename, null, originalColumns);
}
