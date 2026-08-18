import { resolveCategorySlColumn, resolveCategoryTargetColumn } from "./category-targets";
import { pct } from "./targets";
import type { CategoryBreakdown, SalesRow, TargetData } from "./types";

function rowRevenue(r: SalesRow): number {
  return r.netRevenue || r.grossAmount || r.revenue;
}

function slUnitForCategory(category: string): "chi" | "piece" {
  switch (category) {
    case "Vàng tích lũy":
    case "Bạc tích lũy":
    case "TS vàng ta":
    case "Nguyên liệu":
      return "chi";
    default:
      return "piece";
  }
}

function hideSlForCategory(category: string): boolean {
  const n = category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return n.includes("trang suc khac") || slUnitForCategory(category) === "piece";
}

function slForRow(r: SalesRow, category: string): number {
  return slUnitForCategory(category) === "chi" ? r.goldWeight : r.quantity;
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
  const quantityTotal = rows.reduce((a, r) => a + r.quantity, 0);
  const variancePct =
    grossTotal > 0 ? Math.abs(grossTotal - netRevenue) / grossTotal : null;

  const planMonth = target.planMonth;
  const planSales = sales.filter(
    (r) => r.date.startsWith(planMonth) && r.date <= asOfDate,
  );

  const byCat = new Map<
    string,
    {
      revenue: number;
      orders: Set<string>;
      grossProfit: number;
      goldWeight: number;
      quantity: number;
    }
  >();

  rows.forEach((r, idx) => {
    const cat = r.productCategory || "Khác";
    const prev = byCat.get(cat) ?? {
      revenue: 0,
      orders: new Set<string>(),
      grossProfit: 0,
      goldWeight: 0,
      quantity: 0,
    };
    prev.revenue += rowRevenue(r);
    prev.grossProfit += r.grossProfit;
    prev.goldWeight += r.goldWeight;
    prev.quantity += r.quantity;
    const orderKey = r.orderId ?? `line-${r.date}-${idx}-${r.productLine}`;
    prev.orders.add(orderKey);
    byCat.set(cat, prev);
  });

  const cumulativeActualByCat = new Map<string, number>();
  const cumulativeSlByCat = new Map<string, number>();
  const cumulativeGoldWeightByCat = new Map<string, number>();
  for (const r of planSales) {
    const cat = r.productCategory || "Khác";
    cumulativeActualByCat.set(cat, (cumulativeActualByCat.get(cat) ?? 0) + rowRevenue(r));
    cumulativeSlByCat.set(cat, (cumulativeSlByCat.get(cat) ?? 0) + slForRow(r, cat));
    cumulativeGoldWeightByCat.set(
      cat,
      (cumulativeGoldWeightByCat.get(cat) ?? 0) + r.goldWeight,
    );
  }

  const catToColumn = new Map<string, string>();
  const catToSlColumn = new Map<string, string>();
  for (const cat of new Set([...byCat.keys(), ...cumulativeActualByCat.keys()])) {
    const col = resolveCategoryTargetColumn(cat, target);
    if (col) catToColumn.set(cat, col);
    if (!hideSlForCategory(cat)) {
      const slCol = resolveCategorySlColumn(cat, target);
      if (slCol) catToSlColumn.set(cat, slCol);
    }
  }

  const monthTargetByCat = prorateMonthTargets(cumulativeActualByCat, catToColumn, target);
  const slMonthTargetByCat = prorateMonthTargets(cumulativeSlByCat, catToSlColumn, target);

  const categories = [...byCat.entries()]
    .map(([category, v]) => {
      const cumulativeRevenue = cumulativeActualByCat.get(category) ?? 0;
      const monthTarget = monthTargetByCat.get(category) ?? 0;
      const hideSl = hideSlForCategory(category);
      const slUnit = slUnitForCategory(category);
      const cumulativeSl = hideSl ? 0 : (cumulativeSlByCat.get(category) ?? 0);
      const slMonthTarget = hideSl ? 0 : (slMonthTargetByCat.get(category) ?? 0);

      return {
        category,
        revenue: v.revenue,
        sharePct: netRevenue > 0 ? v.revenue / netRevenue : 0,
        orderCount: v.orders.size,
        grossProfit: v.grossProfit,
        cumulativeRevenue,
        monthTarget,
        cumulativePct: pct(cumulativeRevenue, monthTarget),
        goldWeight: v.goldWeight,
        quantity: v.quantity,
        slUnit,
        hideSl,
        cumulativeSl,
        slMonthTarget,
        cumulativeSlPct: hideSl ? null : pct(cumulativeSl, slMonthTarget),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totalCumulativeRevenue = [...cumulativeActualByCat.values()].reduce((a, v) => a + v, 0);
  const totalMonthTarget = [...new Set(catToColumn.values())].reduce(
    (s, colKey) => s + (target.monthTotals[colKey] ?? 0),
    0,
  );
  const cumulativeGoldWeight = [...cumulativeGoldWeightByCat.values()].reduce((a, v) => a + v, 0);
  const slMonthTarget = [...new Set(catToSlColumn.values())].reduce(
    (s, colKey) => s + (target.monthTotals[colKey] ?? 0),
    0,
  );

  return {
    grossTotal,
    netRevenue,
    variancePct,
    goldWeightTotal,
    quantityTotal,
    asOfDate,
    cumulativeRevenue: totalCumulativeRevenue,
    monthTarget: totalMonthTarget,
    cumulativePct: pct(totalCumulativeRevenue, totalMonthTarget),
    cumulativeGoldWeight,
    slMonthTarget,
    cumulativeSlPct: pct(cumulativeGoldWeight, slMonthTarget),
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
