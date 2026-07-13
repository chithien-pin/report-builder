import type { ColumnDtype, ColumnInfo } from "@/lib/types";

/** Cột có tên gợi ý số liệu (tránh nhận nhầm thành ngày). */
const NUMERIC_NAME_HINTS = [
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
  "gia",
  "giá",
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
  "stt",
  "id pt",
  "ma phieu",
];

const DATE_NAME_HINTS = ["date", "ngay", "ngày", "time", "created", "updated"];

function normalizeName(columnName: string): string {
  return columnName.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export function hasNumericNameHint(columnName: string): boolean {
  const name = normalizeName(columnName);
  return NUMERIC_NAME_HINTS.some((hint) => name.includes(normalizeName(hint)));
}

export function hasDateNameHint(columnName: string): boolean {
  const name = normalizeName(columnName);
  // "ngay sinh" ok; avoid matching numeric cols that happen to contain nothing date-like
  if (hasNumericNameHint(columnName) && !name.includes("ngay") && !name.includes("date")) {
    return false;
  }
  return DATE_NAME_HINTS.some((hint) => name.includes(normalizeName(hint)));
}

/** Sửa dtype sai từ cache cũ (số bị gắn date). */
export function repairColumnInfo(col: ColumnInfo): ColumnInfo {
  if (col.dtype === "date" && hasNumericNameHint(col.original_name || col.name)) {
    return { ...col, dtype: "number" };
  }
  return col;
}

export function repairColumns(columns: ColumnInfo[]): ColumnInfo[] {
  return columns.map(repairColumnInfo);
}

/** Cột nên ưu tiên cho Sum (số thật hoặc tên gợi ý số). */
export function isSummableColumn(col: ColumnInfo): boolean {
  const repaired = repairColumnInfo(col);
  if (repaired.dtype === "number" || repaired.dtype === "float") return true;
  if (hasNumericNameHint(col.original_name || col.name)) return true;
  return false;
}

/** Cột số dùng cho Sum. */
export function summableColumns(columns: ColumnInfo[]): ColumnInfo[] {
  return repairColumns(columns).filter(isSummableColumn);
}

export function formatCellValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "bigint") return Number(value).toLocaleString("vi-VN");
  if (typeof value === "number") {
    return value.toLocaleString("vi-VN");
  }
  return String(value);
}

export function effectiveDtypeForDisplay(col: ColumnInfo): ColumnDtype {
  return repairColumnInfo(col).dtype;
}

/** Header bảng chi tiết: đủ cột meta + cột phát sinh từ data. */
export function resolveDetailColumns(
  metaColumns: ColumnInfo[],
  rows: Record<string, unknown>[],
): ColumnInfo[] {
  const repaired = repairColumns(metaColumns);
  const seen = new Set(repaired.map((c) => c.name));
  const extra: ColumnInfo[] = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        extra.push({ name: key, original_name: key, dtype: "string" });
      }
    }
  }

  return [...repaired, ...extra];
}
