export function round4(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round((n + Number.EPSILON) * 10000) / 10000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function foldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

/** Số trên file Augges: "388.0000" là thập phân, "10,767,599,625" là hàng nghìn. */
export function parseSheetNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed || trimmed === "-" || trimmed === "—") return null;
  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  let normalized = trimmed;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed.replace(/,/g, "");
  } else if (lastComma >= 0 && /^-?\d{1,3}(,\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = trimmed.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatQty(n: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(round4(n));
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function isoFromVnDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatIsoDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function sessionKey(dateIso: string, ca: string): string {
  const ymd = dateIso.replaceAll("-", "");
  const slug = foldKey(ca).slice(0, 24) || "ca";
  return `${ymd}_${slug}`;
}

export function lineId(category: string, section: string, label: string): string {
  return `${category}__${section}__${foldKey(label) || "dong"}`;
}
