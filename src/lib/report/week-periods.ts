import type { TargetWeekPeriod } from "./types";

const DATE_RANGE_RE = /(\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})/;
const WEEK_LABEL_RE = /tu[aă]n\s*(\d+)/i;
const PCT_RE = /(\d+(?:[.,]\d+)?)\s*%/;

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInclusive(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

/** e.g. "tháng 8_2026" → "2026-08", "T7" → "2026-07" */
export function parsePlanMonthFromFilename(filename: string, refYear?: number): string | null {
  const year = refYear ?? new Date().getFullYear();
  const lower = filename.normalize("NFC").toLowerCase();

  const explicit = lower.match(/th[aá]ng\s*(\d{1,2})[_\s-]*(\d{4})/);
  if (explicit) {
    return `${explicit[2]}-${String(Number(explicit[1])).padStart(2, "0")}`;
  }

  const monthOnly = lower.match(/th[aá]ng\s*(\d{1,2})/);
  if (monthOnly) {
    return `${year}-${String(Number(monthOnly[1])).padStart(2, "0")}`;
  }

  const tMonth = lower.match(/\bt(\d{1,2})\b/);
  if (tMonth) {
    return `${year}-${String(Number(tMonth[1])).padStart(2, "0")}`;
  }

  return null;
}

/** Scan spreadsheet header rows for TUẦN blocks with date range + %. */
export function parseWeekPeriodsFromMatrix(
  matrix: string[][],
  planMonth: string,
): TargetWeekPeriod[] {
  const year = Number(planMonth.slice(0, 4));
  const found = new Map<string, TargetWeekPeriod>();

  for (let r = 0; r < Math.min(matrix.length, 20); r++) {
    const row = matrix[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (!WEEK_LABEL_RE.test(cell)) continue;

      const labelMatch = cell.match(WEEK_LABEL_RE);
      const label = labelMatch ? `TUẦN ${labelMatch[1]}` : cell.toUpperCase();

      const parts: string[] = [cell];
      for (let dc = c + 1; dc < Math.min(c + 8, row.length); dc++) {
        parts.push(String(row[dc] ?? ""));
      }
      const below = matrix[r + 1] ?? [];
      for (let dc = c; dc < Math.min(c + 8, below.length); dc++) {
        parts.push(String(below[dc] ?? ""));
      }
      const blob = parts.join(" ");

      const range = blob.match(DATE_RANGE_RE);
      const pct = blob.match(PCT_RE);
      if (!range || !pct) continue;

      const startDate = isoDate(year, Number(range[2]), Number(range[1]));
      const endDate = isoDate(year, Number(range[4]), Number(range[3]));
      const pctValue = Number(pct[1].replace(",", ".")) / 100;
      const days = daysInclusive(startDate, endDate);
      if (days <= 0 || pctValue <= 0) continue;

      if (!found.has(label)) {
        found.set(label, { label, startDate, endDate, pct: pctValue, days });
      }
    }
  }

  return [...found.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Known plan for August 2026 (MH35 structure). */
export function defaultWeekPeriodsForMonth(planMonth: string): TargetWeekPeriod[] {
  if (planMonth === "2026-08") {
    return [
      {
        label: "TUẦN 1",
        startDate: "2026-08-01",
        endDate: "2026-08-09",
        pct: 0.3,
        days: 9,
      },
      {
        label: "TUẦN 2",
        startDate: "2026-08-10",
        endDate: "2026-08-16",
        pct: 0.25,
        days: 7,
      },
      {
        label: "TUẦN 3",
        startDate: "2026-08-17",
        endDate: "2026-08-23",
        pct: 0.25,
        days: 7,
      },
      {
        label: "TUẦN 4",
        startDate: "2026-08-24",
        endDate: "2026-08-31",
        pct: 0.2,
        days: 8,
      },
    ];
  }

  const [y, m] = planMonth.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return [
    {
      label: "THÁNG",
      startDate: `${y}-${mm}-01`,
      endDate: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
      pct: 1,
      days: lastDay,
    },
  ];
}

export function resolveWeekPeriods(
  matrix: string[][],
  filename: string,
): { planMonth: string; weekPeriods: TargetWeekPeriod[] } {
  const planMonth =
    parsePlanMonthFromFilename(filename) ??
    new Date().toISOString().slice(0, 7);

  const parsed = parseWeekPeriodsFromMatrix(matrix, planMonth);
  const weekPeriods =
    parsed.length > 0 ? parsed : defaultWeekPeriodsForMonth(planMonth);

  return { planMonth, weekPeriods };
}

export function normalizeTargetWeekPeriods(
  weekPeriods: TargetWeekPeriod[] | undefined,
  planMonth: string | undefined,
  filename: string,
): { planMonth: string; weekPeriods: TargetWeekPeriod[] } {
  const month = planMonth ?? parsePlanMonthFromFilename(filename) ?? new Date().toISOString().slice(0, 7);
  if (weekPeriods && weekPeriods.length > 0) {
    return { planMonth: month, weekPeriods };
  }
  return { planMonth: month, weekPeriods: defaultWeekPeriodsForMonth(month) };
}
