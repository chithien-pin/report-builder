import Papa from "papaparse";
import * as XLSX from "xlsx";

import type { SalesRow, TargetColumn, TargetData } from "./types";

function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 30000 || serial >= 100000) return null;
  // Epoch 1899-12-30 already encodes the Lotus leap-year quirk — do not subtract 1.
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 2100) return null;
  return `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function toNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    let serial = (value.getTime() - excelEpoch) / 86400000;
    if (serial >= 60) serial += 1;
    return Number.isFinite(serial) ? serial : 0;
  }
  return parseVnNumber(String(value));
}

function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  const keys = Object.keys(row);
  for (const name of names) {
    const hit = keys.find((k) => k.trim().toLowerCase() === name.toLowerCase());
    if (hit != null) return row[hit];
  }
  // fuzzy
  for (const name of names) {
    const needle = name.toLowerCase();
    const hit = keys.find((k) => k.trim().toLowerCase().includes(needle));
    if (hit != null) return row[hit];
  }
  return null;
}

export function parseSalesBuffer(content: Buffer, filename: string): {
  rows: SalesRow[];
  productLines: string[];
  dates: string[];
  storeCode: string | null;
} {
  const lower = filename.toLowerCase();
  let rawRows: Record<string, unknown>[];

  if (lower.endsWith(".csv")) {
    const parsed = Papa.parse<Record<string, unknown>>(content.toString("utf-8"), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    if (parsed.errors[0]) throw new Error(parsed.errors[0].message);
    rawRows = parsed.data;
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(content, { type: "buffer", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  } else {
    throw new Error("File doanh số phải là CSV hoặc XLSX");
  }

  const sales: SalesRow[] = [];
  let storeCode: string | null = null;

  for (const row of rawRows) {
    const ngayRaw = pick(row, "Ngay", "Ngày", "NGAY", "Date");
    let date: string | null = null;
    if (typeof ngayRaw === "number") date = excelSerialToIso(ngayRaw);
    else if (typeof ngayRaw === "string" && /^\d{4,5}$/.test(ngayRaw.trim())) {
      date = excelSerialToIso(Number(ngayRaw.trim()));
    } else if (typeof ngayRaw === "string" && /^\d{4}-\d{2}-\d{2}/.test(ngayRaw)) {
      date = ngayRaw.slice(0, 10);
    }
    if (!date) continue;

    const productLine = String(
      pick(row, "Dòng sản phẩm", "Dong san pham", "Dòng SP") ?? "",
    ).trim();
    if (!productLine || productLine.toLowerCase() === "total") continue;

    const quantity = toNumber(pick(row, "SO LUONG", "Số lượng", "So luong"));
    const goldWeight = toNumber(
      pick(row, "TRONG LUONG VANG", "Trọng lượng vàng", "TONG TRONG LUONG"),
    );
    let revenue = toNumber(pick(row, "THANH TIEN", "Thành tiền"));
    if (!revenue) revenue = toNumber(pick(row, "DOANH THU THUAN", "Doanh thu thuần"));

    if (!storeCode) {
      const sc = pick(row, "Ma CH", "Mã CH", "MA CH");
      if (sc) storeCode = String(sc);
    }

    sales.push({ date, productLine, quantity, goldWeight, revenue });
  }

  if (sales.length === 0) {
    throw new Error("Không tìm thấy dòng bán hàng hợp lệ (cần cột Ngay + Dòng sản phẩm)");
  }

  const productLines = [...new Set(sales.map((r) => r.productLine))].sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
  const dates = [...new Set(sales.map((r) => r.date))].sort();

  return { rows: sales, productLines, dates, storeCode };
}

function parseVnNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, "");
  if (!s || s === "-" || s === "0") return 0;
  // 7.828.833.077 or 7,828,833.077
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    return Number(s.replace(/,/g, "")) || 0;
  }
  if (/^\d+,\d+$/.test(s)) return Number(s.replace(",", ".")) || 0;
  if (/^\d+\.\d+$/.test(s) && s.split(".")[1].length <= 2) return Number(s) || 0;
  return Number(s.replace(/,/g, "").replace(/\./g, (m, offset, str) => {
    // if multiple dots, strip all; if one dot as decimal keep
    const dots = (str.match(/\./g) || []).length;
    return dots > 1 ? "" : m;
  })) || 0;
}

/**
 * Parse target.csv with multi-row headers.
 * Detects header row containing "Mã nhân viên", finds TỔNG row.
 */
export function parseTargetBuffer(content: Buffer, filename: string): TargetData {
  const text = filename.toLowerCase().endsWith(".xlsx")
    ? (() => {
        const wb = XLSX.read(content, { type: "buffer", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        return XLSX.utils.sheet_to_csv(ws);
      })()
    : content.toString("utf-8");

  const matrix = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false }).data as string[][];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i] ?? [];
    const joined = row.join("|").toLowerCase();
    if (joined.includes("mã nhân viên") || joined.includes("ma nhan vien")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    // fallback: first non-empty row with >5 cells
    headerIdx = matrix.findIndex((r) => r.filter((c) => String(c ?? "").trim()).length > 5);
  }
  if (headerIdx < 0) throw new Error("Không đọc được header file target");

  const headerRow = (matrix[headerIdx] ?? []).map((c) => String(c ?? "").trim());
  const rawSection = (matrix[Math.max(0, headerIdx - 1)] ?? []).map((c) => String(c ?? "").trim());
  // Forward-fill sparse section headers (Doanh thu / Sản lượng)
  const sectionRow: string[] = [];
  let lastSection = "";
  for (let i = 0; i < Math.max(headerRow.length, rawSection.length); i++) {
    const cur = rawSection[i] || "";
    if (cur) lastSection = cur;
    sectionRow[i] = lastSection;
  }

  const columns: TargetColumn[] = [];
  const seenLabelKind = new Set<string>();

  for (let i = 0; i < headerRow.length; i++) {
    const label = headerRow[i].replace(/\s+/g, " ").trim();
    if (!label) continue;
    // skip identity columns
    if (/^(mã|ma)\s*nhân/i.test(label) || /^tên nhân/i.test(label)) continue;
    if (/^chức vụ$/i.test(label) || /^cấp bậc$/i.test(label)) continue;
    if (/^hệ số$/i.test(label) || /^tỷ trọng$/i.test(label)) continue;
    if (/^tổng$/i.test(label)) continue;

    const section = sectionRow[i] || "";
    // Prefer first kế hoạch block; skip "Sản lượng Tính lương" duplicates
    if (/tính lương/i.test(section)) continue;

    let kind: TargetColumn["kind"] = "other";
    if (/doanh thu/i.test(section)) kind = "dt";
    else if (/sản lượng|san luong/i.test(section)) kind = "sl";
    else if (/\(chỉ\)|\(chiếc\)/i.test(label)) kind = "sl";

    const dedupeKey = `${kind}::${label.toLowerCase()}`;
    if (seenLabelKind.has(dedupeKey)) continue;
    seenLabelKind.add(dedupeKey);

    const key = `col_${i}_${label}`;
    columns.push({
      key,
      label: section ? `${label} · ${section}` : label,
      kind,
    });
  }

  // Find TỔNG row
  let tongRow: string[] | null = null;
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const first = String(row[0] ?? "").trim().toUpperCase();
    if (first === "TỔNG" || first === "TONG") {
      tongRow = row.map((c) => String(c ?? ""));
      break;
    }
  }

  // Fallback: last numeric-heavy row
  if (!tongRow) {
    for (let i = matrix.length - 1; i > headerIdx; i--) {
      const row = matrix[i] ?? [];
      const nums = row.filter((c) => parseVnNumber(String(c ?? "")) > 0).length;
      if (nums >= 3) {
        tongRow = row.map((c) => String(c ?? ""));
        break;
      }
    }
  }

  if (!tongRow) throw new Error("Không tìm thấy hàng TỔNG trong file target");

  const monthTotals: Record<string, number> = {};
  for (const col of columns) {
    const idx = Number(col.key.split("_")[1]);
    monthTotals[col.key] = parseVnNumber(tongRow[idx] ?? "0");
  }

  return { columns, monthTotals };
}
