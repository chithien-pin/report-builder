import { filterSalesByDateRange } from "./date-range";
import type { OverviewOpsKpi, SalesRow } from "./types";

function rowRevenue(r: SalesRow): number {
  return r.netRevenue || r.grossAmount || r.revenue;
}

export function buildOverviewOpsKpi(
  sales: SalesRow[],
  fromDate?: string | null,
  toDate?: string | null,
): OverviewOpsKpi {
  const rows = filterSalesByDateRange(sales, fromDate, toDate);
  const orders = new Set<string>();
  let revenue = 0;
  let itemCount = 0;

  rows.forEach((r, idx) => {
    revenue += rowRevenue(r);
    itemCount += r.quantity;
    orders.add(r.orderId ?? `line-${r.date}-${idx}-${r.productLine}`);
  });

  const orderCount = orders.size;
  const aov = orderCount > 0 ? revenue / orderCount : 0;
  const upt = orderCount > 0 ? itemCount / orderCount : 0;

  return {
    revenue,
    orderCount,
    itemCount,
    aov,
    upt,
  };
}
