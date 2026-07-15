import {
  cumulativeTargetFromMonth,
  dailyTargetFromMonth,
  pct,
} from "./targets";
import type {
  DailyCompactRow,
  DayReport,
  GroupConfig,
  GroupDayMetrics,
  MetricActual,
  ReportGroup,
  SalesRow,
  TargetData,
} from "./types";

function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
}

function buildMetric(
  actual: number,
  cumulativeActual: number,
  monthTarget: number,
  date: string,
): MetricActual {
  const target = dailyTargetFromMonth(monthTarget, date);
  const cumulativeTarget = cumulativeTargetFromMonth(monthTarget, date);
  const a = round(actual);
  const ca = round(cumulativeActual);
  return {
    actual: a,
    target: round(target, 2),
    pct: pct(a, target),
    cumulativeActual: ca,
    cumulativeTarget: round(cumulativeTarget, 2),
    cumulativePct: pct(ca, cumulativeTarget),
    monthTarget,
    monthPct: pct(ca, monthTarget),
    remaining: Math.max(0, round(monthTarget - ca, 2)),
  };
}

function slForRow(row: SalesRow, group: ReportGroup): number {
  return group.slUnit === "chi" ? row.goldWeight : row.quantity;
}

function resolveGroup(
  productLine: string,
  config: GroupConfig,
): ReportGroup | null {
  for (const g of config.groups) {
    if (g.productLines.includes(productLine)) return g;
  }
  if (config.fallbackGroupId) {
    return config.groups.find((g) => g.id === config.fallbackGroupId) ?? null;
  }
  return null;
}

function monthTargetFor(
  group: ReportGroup,
  target: TargetData,
  kind: "dt" | "sl",
): number {
  const key = kind === "dt" ? group.targetDtColumn : group.targetSlColumn;
  if (!key) return 0;
  return target.monthTotals[key] ?? 0;
}

type Acc = { sl: number; dt: number };

function aggregateByDateGroup(
  sales: SalesRow[],
  config: GroupConfig,
): Map<string, Map<string, Acc>> {
  const byDate = new Map<string, Map<string, Acc>>();

  for (const row of sales) {
    const group = resolveGroup(row.productLine, config);
    if (!group) continue;
    if (!byDate.has(row.date)) byDate.set(row.date, new Map());
    const dayMap = byDate.get(row.date)!;
    const prev = dayMap.get(group.id) ?? { sl: 0, dt: 0 };
    prev.sl += slForRow(row, group);
    prev.dt += row.revenue;
    dayMap.set(group.id, prev);
  }

  return byDate;
}

export function buildDayReport(
  sales: SalesRow[],
  target: TargetData,
  config: GroupConfig,
  date: string,
): DayReport {
  const byDate = aggregateByDateGroup(sales, config);
  const dates = [...byDate.keys()].sort();
  const monthStart = date.slice(0, 7);

  const cumByGroup = new Map<string, Acc>();
  for (const g of config.groups) cumByGroup.set(g.id, { sl: 0, dt: 0 });

  for (const d of dates) {
    if (!d.startsWith(monthStart) || d > date) continue;
    const dayMap = byDate.get(d);
    if (!dayMap) continue;
    for (const [gid, acc] of dayMap) {
      const prev = cumByGroup.get(gid) ?? { sl: 0, dt: 0 };
      prev.sl += acc.sl;
      prev.dt += acc.dt;
      cumByGroup.set(gid, prev);
    }
  }

  const dayMap = byDate.get(date) ?? new Map<string, Acc>();

  const groups: GroupDayMetrics[] = config.groups.map((g) => {
    const day = dayMap.get(g.id) ?? { sl: 0, dt: 0 };
    const cum = cumByGroup.get(g.id) ?? { sl: 0, dt: 0 };
    const monthSl = monthTargetFor(g, target, "sl");
    const monthDt = monthTargetFor(g, target, "dt");
    return {
      groupId: g.id,
      groupName: g.name,
      sl: buildMetric(day.sl, cum.sl, monthSl, date),
      dt: buildMetric(day.dt, cum.dt, monthDt, date),
    };
  });

  const totalDay = groups.reduce(
    (a, g) => ({ sl: a.sl + g.sl.actual, dt: a.dt + g.dt.actual }),
    { sl: 0, dt: 0 },
  );
  const totalCum = groups.reduce(
    (a, g) => ({
      sl: a.sl + g.sl.cumulativeActual,
      dt: a.dt + g.dt.cumulativeActual,
    }),
    { sl: 0, dt: 0 },
  );
  const totalMonthSl = groups.reduce((a, g) => a + g.sl.monthTarget, 0);
  const totalMonthDt = groups.reduce((a, g) => a + g.dt.monthTarget, 0);

  const total: GroupDayMetrics = {
    groupId: "tong",
    groupName: "TỔNG",
    sl: buildMetric(totalDay.sl, totalCum.sl, totalMonthSl, date),
    dt: buildMetric(totalDay.dt, totalCum.dt, totalMonthDt, date),
  };

  return { date, groups, total };
}

export function buildDailySeries(
  sales: SalesRow[],
  target: TargetData,
  config: GroupConfig,
): DailyCompactRow[] {
  const dates = [...new Set(sales.map((r) => r.date))].sort();
  return dates.map((date) => {
    const report = buildDayReport(sales, target, config, date);
    return {
      date,
      slActual: report.total.sl.actual,
      slTarget: report.total.sl.target,
      slPct: report.total.sl.pct,
      dtActual: report.total.dt.actual,
      dtTarget: report.total.dt.target,
      dtPct: report.total.dt.pct,
    };
  });
}

export function allProductLinesUsed(config: GroupConfig): Set<string> {
  const set = new Set<string>();
  for (const g of config.groups) {
    for (const p of g.productLines) set.add(p);
  }
  return set;
}
