import { resolveCategoryTargetColumn } from "./category-targets";
import { pct } from "./targets";
import type { CategoryBreakdown, SalesRow, TargetData } from "./types";

function rowRevenue(r: SalesRow): number {
  return r.netRevenue || r.grossAmount || r.revenue;
}

function prorateMonthTargets(
  cumulativeActualByCat: Map<string, number>,
  catToColumn: Map<string, string>,
  target: TargetData,
): Map<string, number> {
  const monthTargetByCat = new Map<string, number>();

  for (const colKey of new Set(catToColumn.values())) {
    const bucketCats = [...catToColumn.entries()]
      .filter(([, k]) => k === colKey)
      .map(([c]) => c);
    const bucketMonthTarget = target.monthTotals[colKey] ?? 0;
    const bucketActual = bucketCats.reduce(
      (s, c) => s + (cumulativeActualByCat.get(c) ?? 0),
      0,
    );

    for (const cat of bucketCats) {
      const catActual = cumulativeActualByCat.get(cat) ?? 0;
      const prorated =
        bucketActual > 0
          ? bucketMonthTarget * (catActual / bucketActual)
          : bucketMonthTarget / bucketCats.length;
      monthTargetByCat.set(cat, prorated);
    }
  }

  return monthTargetByCat;
}

function aggregateRows(
  rows: SalesRow[],
  sales: SalesRow[],
  target: TargetData,
  asOfDate: string,
): CategoryBreakdown {
  const grossTotal = rows.reduce((a, r) => a + (r.grossAmount || r.revenue), 0);
  const netRevenue = rows.reduce(
    (a, r) => a + (r.netRevenue || r.grossAmount || r.revenue),
    0,
  );
  const goldWeightTotal = rows.reduce((a, r) => a + r.goldWeight, 0);
  const variancePct =
    grossTotal > 0 ? Math.abs(grossTotal - netRevenue) / grossTotal : null;

  const planMonth = target.planMonth;
  const planSales = sales.filter(
    (r) => r.date.startsWith(planMonth) && r.date <= asOfDate,
  );

  const byCat = new Map<
    string,
    { revenue: number; orders: Set<string>; grossProfit: number }
  >();

  rows.forEach((r, idx) => {
    const cat = r.productCategory || "Khác";
    const prev = byCat.get(cat) ?? { revenue: 0, orders: new Set<string>(), grossProfit: 0 };
    prev.revenue += rowRevenue(r);
    prev.grossProfit += r.grossProfit;
    const orderKey = r.orderId ?? `line-${r.date}-${idx}-${r.productLine}`;
    prev.orders.add(orderKey);
    byCat.set(cat, prev);
  });

  const cumulativeActualByCat = new Map<string, number>();
  for (const r of planSales) {
    const cat = r.productCategory || "Khác";
    cumulativeActualByCat.set(cat, (cumulativeActualByCat.get(cat) ?? 0) + rowRevenue(r));
  }

  const catToColumn = new Map<string, string>();
  for (const cat of new Set([...byCat.keys(), ...cumulativeActualByCat.keys()])) {
    const col = resolveCategoryTargetColumn(cat, target);
    if (col) catToColumn.set(cat, col);
  }

  const monthTargetByCat = prorateMonthTargets(cumulativeActualByCat, catToColumn, target);

  const categories = [...byCat.entries()]
    .map(([category, v]) => {
      const cumulativeRevenue = cumulativeActualByCat.get(category) ?? 0;
      const monthTarget = monthTargetByCat.get(category) ?? 0;

      return {
        category,
        revenue: v.revenue,
        sharePct: netRevenue > 0 ? v.revenue / netRevenue : 0,
        orderCount: v.orders.size,
        grossProfit: v.grossProfit,
        cumulativeRevenue,
        monthTarget,
        cumulativePct: pct(cumulativeRevenue, monthTarget),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totalCumulativeRevenue = [...cumulativeActualByCat.values()].reduce((a, v) => a + v, 0);
  const totalMonthTarget = [...new Set(catToColumn.values())].reduce(
    (s, colKey) => s + (target.monthTotals[colKey] ?? 0),
    0,
  );

  return {
    grossTotal,
    netRevenue,
    variancePct,
    goldWeightTotal,
    asOfDate,
    cumulativeRevenue: totalCumulativeRevenue,
    monthTarget: totalMonthTarget,
    cumulativePct: pct(totalCumulativeRevenue, totalMonthTarget),
    categories,
  };
}

export interface BuildCategoryBreakdownOptions {
  /** Filter period stats to this day; omit for all rows in `sales`. */
  periodDate?: string | null;
  /** Cumulative actual calculated through this date (inclusive). */
  asOfDate: string;
}

export function buildCategoryBreakdown(
  sales: SalesRow[],
  target: TargetData,
  opts: BuildCategoryBreakdownOptions,
): CategoryBreakdown {
  const periodRows = opts.periodDate
    ? sales.filter((r) => r.date === opts.periodDate)
    : sales;
  return aggregateRows(periodRows, sales, target, opts.asOfDate);
}
