/** Week weights matching Google Sheet Target tab (80% planned across 31 days). */
export const WEEK_WEIGHTS: { startDay: number; endDay: number; pct: number; days: number }[] = [
  { startDay: 1, endDay: 7, pct: 0.1, days: 7 },
  { startDay: 8, endDay: 14, pct: 0.2, days: 7 },
  { startDay: 15, endDay: 21, pct: 0.2, days: 7 },
  { startDay: 22, endDay: 28, pct: 0.2, days: 7 },
  { startDay: 29, endDay: 31, pct: 0.1, days: 3 },
];

export function dayOfMonthFromIso(date: string): number {
  return Number(date.slice(8, 10));
}

export function dailyTargetFraction(dayOfMonth: number): number {
  const week = WEEK_WEIGHTS.find((w) => dayOfMonth >= w.startDay && dayOfMonth <= w.endDay);
  if (!week) return 0;
  return week.pct / week.days;
}

export function dailyTargetFromMonth(monthTarget: number, date: string): number {
  return monthTarget * dailyTargetFraction(dayOfMonthFromIso(date));
}

/** Cumulative target from day 1 of month through `date` (inclusive). */
export function cumulativeTargetFromMonth(monthTarget: number, date: string): number {
  const day = dayOfMonthFromIso(date);
  let sum = 0;
  for (let d = 1; d <= day; d++) {
    sum += monthTarget * dailyTargetFraction(d);
  }
  return sum;
}

export function pct(actual: number, target: number): number | null {
  if (!Number.isFinite(target) || target === 0) return null;
  return actual / target;
}
