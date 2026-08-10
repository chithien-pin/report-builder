import type { TargetWeekPeriod } from "./types";

export function findWeekPeriod(
  date: string,
  weekPeriods: TargetWeekPeriod[],
): TargetWeekPeriod | null {
  return weekPeriods.find((w) => date >= w.startDate && date <= w.endDate) ?? null;
}

export function dailyTargetFraction(
  date: string,
  weekPeriods: TargetWeekPeriod[],
): number {
  const week = findWeekPeriod(date, weekPeriods);
  if (!week || week.days <= 0) return 0;
  return week.pct / week.days;
}

export function dailyTargetFromMonth(
  monthTarget: number,
  date: string,
  weekPeriods: TargetWeekPeriod[],
): number {
  return monthTarget * dailyTargetFraction(date, weekPeriods);
}

function datesThrough(endDate: string, weekPeriods: TargetWeekPeriod[]): string[] {
  if (weekPeriods.length === 0) return [];
  const startDate = weekPeriods.reduce(
    (min, w) => (w.startDate < min ? w.startDate : min),
    weekPeriods[0]!.startDate,
  );
  const out: string[] = [];
  const cur = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Cumulative target from first plan day through `date` (inclusive). */
export function cumulativeTargetFromMonth(
  monthTarget: number,
  date: string,
  weekPeriods: TargetWeekPeriod[],
): number {
  let sum = 0;
  for (const d of datesThrough(date, weekPeriods)) {
    sum += dailyTargetFraction(d, weekPeriods);
  }
  return monthTarget * sum;
}

export function pct(actual: number, target: number): number | null {
  if (!Number.isFinite(target) || target === 0) return null;
  return actual / target;
}
