import Papa from "papaparse";
import * as XLSX from "xlsx";
import { foldKey, isoFromVnDate, parseSheetNumber, round4 } from "@/lib/check-stock/format";
import { normalizeCode } from "@/lib/check-stock/match";
import { DEFAULT_COLUMNS, type ColumnMap, type SystemRow } from "@/lib/check-stock/types";

export type IntegrityGap = {
  maNhom: string;
  detailSl: number;
  totalSl: number;
  detailCount: number;
};

export type ImportReport = {
  reportDate: string | null;
  rows: SystemRow[];
  readCount: number;
  skippedCount: number;
  duplicateCodes: string[];
  missingColumns: string[];
  integrity: IntegrityGap[];
  headerRow: number;
};

const DATE_PATTERN = /Ngày\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;

type Cell = { text: string; num: number | null };

const OPTIONAL_LABEL: Record<Exclude<keyof ColumnMap, "maHang" | "maNhom" | "sl">, string> = {
  maVach: "Mã vạch",
  ten: "Tên hàng",
  donVi: "Đ.Vị",
  nhomLon: "Nhóm lớn",
  tenNhomLon: "Tên nhóm lớn",
  chungLoai: "Chủng loại",
  tenChungLoai: "Tên chủng loại",
  trongLuong: "TT.Lượng",
};

function textCell(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function parseSystemTable(table: Cell[][], columns: ColumnMap = DEFAULT_COLUMNS): ImportReport | { error: string } {
  const rows = table.filter((row) => row.some((cell) => cell.text !== "" || cell.num != null));
  if (rows.length === 0) return { error: "File trống." };

  let reportDate: string | null = null;
  for (const row of rows.slice(0, 20)) {
    const found = row.map((cell) => cell.text).join(" ").match(DATE_PATTERN);
    if (found) {
      reportDate = isoFromVnDate(found[1]);
      break;
    }
  }

  const wanted = Object.fromEntries(
    (Object.keys(columns) as (keyof ColumnMap)[]).map((key) => [key, foldKey(columns[key])]),
  ) as Record<keyof ColumnMap, string>;

  let headerAt = -1;
  let index: Partial<Record<keyof ColumnMap, number>> = {};
  const scan = Math.min(rows.length, 40);
  for (let i = 0; i < scan; i += 1) {
    const found: Partial<Record<keyof ColumnMap, number>> = {};
    rows[i].forEach((cell, cellIndex) => {
      const folded = foldKey(cell.text);
      if (!folded) return;
      (Object.keys(wanted) as (keyof ColumnMap)[]).forEach((key) => {
        if (found[key] != null) return;
        if (folded === wanted[key]) found[key] = cellIndex;
      });
    });
    if (found.maNhom != null && found.maHang != null && found.sl != null) {
      headerAt = i;
      index = found;
      break;
    }
  }
  if (headerAt < 0 || index.maHang == null || index.maNhom == null || index.sl == null) {
    return { error: "Không thấy dòng tiêu đề chứa Mã nhóm, Mã hàng và SL C.Kỳ." };
  }

  const missingColumns = (Object.keys(OPTIONAL_LABEL) as (keyof typeof OPTIONAL_LABEL)[])
    .filter((key) => index[key] == null)
    .map((key) => columns[key] || OPTIONAL_LABEL[key]);

  const textAt = (row: Cell[], key: keyof ColumnMap) => {
    const at = index[key];
    return at == null ? "" : row[at]?.text ?? "";
  };
  const numberAt = (row: Cell[], key: keyof ColumnMap) => {
    const at = index[key];
    if (at == null) return null;
    const cell = row[at];
    if (!cell) return null;
    if (cell.num != null) return cell.num;
    return parseSheetNumber(cell.text);
  };

  const grouped = new Map<string, SystemRow>();
  const seen = new Map<string, number>();
  const totals = new Map<string, number[]>();
  const detailByGroup = new Map<string, { sl: number; count: number }>();
  let skippedCount = 0;

  for (let i = headerAt + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const maHang = textAt(row, "maHang");
    const maNhom = textAt(row, "maNhom");
    if (!maHang) {
      skippedCount += 1;
      if (maNhom) {
        const totalSl = numberAt(row, "sl") ?? 0;
        const list = totals.get(maNhom) ?? [];
        list.push(totalSl);
        totals.set(maNhom, list);
      }
      continue;
    }
    const sl = numberAt(row, "sl") ?? 0;
    const weight = numberAt(row, "trongLuong");
    const key = normalizeCode(maHang);
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const group = detailByGroup.get(maNhom) ?? { sl: 0, count: 0 };
    group.sl = round4(group.sl + sl);
    group.count += 1;
    detailByGroup.set(maNhom, group);

    const previous = grouped.get(key);
    if (!previous) {
      const next: SystemRow = {
        maHang,
        ten: textAt(row, "ten"),
        donVi: textAt(row, "donVi"),
        maNhom,
        sl: round4(sl),
      };
      const maVach = textAt(row, "maVach");
      const nhomLon = textAt(row, "nhomLon");
      const tenNhomLon = textAt(row, "tenNhomLon");
      const chungLoai = textAt(row, "chungLoai");
      const tenChungLoai = textAt(row, "tenChungLoai");
      if (maVach) next.maVach = maVach;
      if (nhomLon) next.nhomLon = nhomLon;
      if (tenNhomLon) next.tenNhomLon = tenNhomLon;
      if (chungLoai) next.chungLoai = chungLoai;
      if (tenChungLoai) next.tenChungLoai = tenChungLoai;
      if (weight != null) next.trongLuong = round4(weight);
      grouped.set(key, next);
      continue;
    }
    previous.sl = round4(previous.sl + sl);
    if (weight != null) previous.trongLuong = round4((previous.trongLuong ?? 0) + weight);
  }

  const integrity: IntegrityGap[] = [];
  for (const [maNhom, totalList] of totals) {
    const detail = detailByGroup.get(maNhom);
    if (!detail || detail.count === 0) continue;
    const totalSl = totalList[totalList.length - 1] ?? 0;
    if (round4(detail.sl) !== round4(totalSl)) {
      integrity.push({
        maNhom,
        detailSl: detail.sl,
        totalSl: round4(totalSl),
        detailCount: detail.count,
      });
    }
  }

  const items = [...grouped.values()];
  const duplicateCodes = items.filter((row) => (seen.get(normalizeCode(row.maHang)) ?? 0) > 1).map((row) => row.maHang);

  return {
    reportDate,
    rows: items,
    readCount: items.length,
    skippedCount,
    duplicateCodes,
    missingColumns,
    integrity,
    headerRow: headerAt + 1,
  };
}

function asCells(table: unknown[][]): Cell[][] {
  return table.map((row) =>
    row.map((value) => ({
      text: textCell(value),
      num: typeof value === "number" && Number.isFinite(value) ? value : null,
    })),
  );
}

function sheetCells(sheet: XLSX.WorkSheet): Cell[][] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const table: Cell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: Cell[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      if (!cell) {
        row.push({ text: "", num: null });
        continue;
      }
      const formatted = cell.w != null ? String(cell.w).trim() : cell.v == null ? "" : String(cell.v).trim();
      row.push({
        text: formatted,
        num: typeof cell.v === "number" && Number.isFinite(cell.v) ? cell.v : null,
      });
    }
    table.push(row);
  }
  return table;
}

export async function parseSystemFile(file: File, columns: ColumnMap = DEFAULT_COLUMNS): Promise<ImportReport | { error: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type.includes("csv")) {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: "greedy" });
    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return { error: "Không đọc được CSV." };
    }
    return parseSystemTable(asCells(parsed.data), columns);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) return { error: "File Excel không có sheet." };
    return parseSystemTable(sheetCells(sheet), columns);
  }
  return { error: "Chỉ nhận file .csv, .xlsx hoặc .xls." };
}
