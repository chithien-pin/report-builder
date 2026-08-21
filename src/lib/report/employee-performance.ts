import { buildEmployeeTargetDetails } from "./employee-targets";
import type {
  EmployeeInsight,
  EmployeePerformance,
  EmployeePerformanceRow,
  SalesRow,
  TargetData,
} from "./types";

function rowRevenue(r: SalesRow): number {
  return r.netRevenue || r.grossAmount || r.revenue;
}

function buildInsights(employees: EmployeePerformanceRow[]): EmployeeInsight[] {
  if (employees.length === 0) return [];

  const insights: EmployeeInsight[] = [];
  const used = new Set<string>();

  const byRevenueRatio = [...employees].sort((a, b) => b.revenueRatio - a.revenueRatio);
  const topRevenue = byRevenueRatio[0];
  const secondRevenue = byRevenueRatio[1];

  if (topRevenue) {
    const caption =
      topRevenue.orderRatio < 1
        ? "Ít đơn nhưng đơn rất lớn — chuyên gia upsell"
        : "Doanh thu cao nhất nhóm";
    insights.push({
      kind: topRevenue.orderRatio < 1 ? "top-upsell" : "balanced",
      name: topRevenue.name,
      revenueRatio: topRevenue.revenueRatio,
      orderRatio: topRevenue.orderRatio,
      caption,
      medal: "gold",
    });
    used.add(topRevenue.name);
  }

  const balancedCandidate = [...employees]
    .filter((e) => !used.has(e.name))
    .sort((a, b) => b.revenueRatio * b.orderRatio - a.revenueRatio * a.orderRatio)[0];

  const balancedPick =
    balancedCandidate && balancedCandidate.revenueRatio >= 1 && balancedCandidate.orderRatio >= 1
      ? balancedCandidate
      : secondRevenue && !used.has(secondRevenue.name)
        ? secondRevenue
        : null;

  if (balancedPick) {
    insights.push({
      kind: "balanced",
      name: balancedPick.name,
      revenueRatio: balancedPick.revenueRatio,
      orderRatio: balancedPick.orderRatio,
      caption: "Cân bằng: nhiều đơn + doanh thu cao",
      medal: "silver",
    });
    used.add(balancedPick.name);
  }

  const highMargin = [...employees]
    .filter((e) => !used.has(e.name))
    .sort((a, b) => b.marginPct - a.marginPct)[0];

  if (highMargin && highMargin.marginPct > 0) {
    insights.push({
      kind: "high-margin",
      name: highMargin.name,
      revenueRatio: highMargin.revenueRatio,
      orderRatio: highMargin.orderRatio,
      marginPct: highMargin.marginPct,
      caption: "Margin cao nhất — bán hàng lợi nhuận",
    });
    used.add(highMargin.name);
  }

  const needsSupport = [...employees]
    .filter((e) => !used.has(e.name))
    .sort((a, b) => a.revenueRatio - b.revenueRatio)[0];

  if (needsSupport && employees.length > 1) {
    insights.push({
      kind: "needs-support",
      name: needsSupport.name,
      revenueRatio: needsSupport.revenueRatio,
      orderRatio: needsSupport.orderRatio,
      aov: needsSupport.aov,
      caption: "Cần hỗ trợ — thấp nhất nhóm",
    });
  }

  return insights.slice(0, 4);
}

export interface BuildEmployeePerformanceOptions {
  periodDate?: string | null;
  /** Inclusive period start (with periodTo). Ignored when periodDate is set. */
  periodFrom?: string | null;
  periodTo?: string | null;
  asOfDate: string;
  target: TargetData;
}

export function buildEmployeePerformance(
  sales: SalesRow[],
  opts: BuildEmployeePerformanceOptions,
): EmployeePerformance {
  let rows = sales;
  if (opts.periodDate) {
    rows = sales.filter((r) => r.date === opts.periodDate);
  } else if (opts.periodFrom || opts.periodTo) {
    rows = sales.filter((r) => {
      if (opts.periodFrom && r.date < opts.periodFrom) return false;
      if (opts.periodTo && r.date > opts.periodTo) return false;
      return true;
    });
  }

  const byEmp = new Map<
    string,
    { revenue: number; orders: Set<string>; quantity: number; grossProfit: number }
  >();

  rows.forEach((r, idx) => {
    const name = r.employeeName || "Không xác định";
    const prev = byEmp.get(name) ?? {
      revenue: 0,
      orders: new Set<string>(),
      quantity: 0,
      grossProfit: 0,
    };
    prev.revenue += rowRevenue(r);
    prev.grossProfit += r.grossProfit;
    prev.quantity += r.quantity;
    const orderKey = r.orderId ?? `line-${r.date}-${idx}-${r.productLine}`;
    prev.orders.add(orderKey);
    byEmp.set(name, prev);
  });

  const totalRevenue = [...byEmp.values()].reduce((a, v) => a + v.revenue, 0);
  const totalOrders = [...byEmp.values()].reduce((a, v) => a + v.orders.size, 0);
  const empCount = byEmp.size || 1;
  const avgRevenue = totalRevenue / empCount;
  const avgOrders = totalOrders / empCount;

  const employees: EmployeePerformanceRow[] = [...byEmp.entries()]
    .map(([name, v]) => {
      const orderCount = v.orders.size;
      const revenue = v.revenue;
      const aov = orderCount > 0 ? revenue / orderCount : 0;
      const itemsPerOrder = orderCount > 0 ? v.quantity / orderCount : 0;
      const marginPct = revenue > 0 ? v.grossProfit / revenue : 0;
      return {
        name,
        revenue,
        revenueSharePct: totalRevenue > 0 ? revenue / totalRevenue : 0,
        orderCount,
        orderSharePct: totalOrders > 0 ? orderCount / totalOrders : 0,
        aov,
        itemsPerOrder,
        grossProfit: v.grossProfit,
        marginPct,
        revenueRatio: avgRevenue > 0 ? revenue / avgRevenue : 0,
        orderRatio: avgOrders > 0 ? orderCount / avgOrders : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const employeeNames = employees.map((e) => e.name);
  const targetDetails = buildEmployeeTargetDetails(
    sales,
    opts.target.employeePlans ?? [],
    opts.asOfDate,
    opts.target.planMonth,
    employeeNames,
  );

  return {
    employees,
    insights: buildInsights(employees),
    targetDetails,
    asOfDate: opts.asOfDate,
  };
}
