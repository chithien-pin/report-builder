import { filterSalesByDateRange } from "./date-range";
import type {
  CustomProductGroup,
  EmployeeTargetBreakdownRow,
  ProductCatalogItem,
  SalesRow,
  SkuSalesLine,
} from "./types";

function rowRevenue(r: SalesRow): number {
  return r.netRevenue || r.grossAmount || r.revenue;
}

function normName(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Match TVV name between target file and sales rows (accents / spacing). */
export function employeeNamesMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const strip = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sa = strip(na);
  const sb = strip(nb);
  return sa === sb || sa.includes(sb) || sb.includes(sa);
}

export function buildProductCatalog(sales: SalesRow[]): ProductCatalogItem[] {
  const map = new Map<string, string>();
  for (const r of sales) {
    const code = (r.productCode || "").trim();
    if (!code) continue;
    const name = (r.productName || code).trim();
    if (!map.has(code) || (map.get(code) === code && name !== code)) {
      map.set(code, name);
    }
  }
  return [...map.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code, "vi"));
}

export function buildSkuSalesLines(
  sales: SalesRow[],
  fromDate?: string | null,
  toDate?: string | null,
): SkuSalesLine[] {
  const ranged = filterSalesByDateRange(sales, fromDate, toDate);
  return ranged
    .filter((r) => (r.productCode || "").trim())
    .map((r) => ({
      date: r.date,
      productCode: r.productCode.trim(),
      productName: (r.productName || r.productCode).trim(),
      employeeName: r.employeeName || "Không xác định",
      quantity: r.quantity,
      revenue: rowRevenue(r),
    }));
}

export function buildCustomGroupBreakdownRow(
  group: CustomProductGroup,
  lines: SkuSalesLine[],
): EmployeeTargetBreakdownRow {
  const codeSet = new Set(group.productCodes);
  let dtActual = 0;
  let slActual = 0;
  for (const line of lines) {
    if (!codeSet.has(line.productCode)) continue;
    dtActual += line.revenue;
    slActual += line.quantity;
  }
  return {
    label: group.name,
    dtActual,
    dtPlan: group.dtPlan,
    slActual,
    slPlan: group.slPlan,
  };
}

export interface CustomGroupDayDetail {
  date: string;
  products: { stt: number; productCode: string; productName: string; quantity: number; revenue: number }[];
  quantityTotal: number;
  revenueTotal: number;
}

export interface CustomGroupEmployeeSummary {
  employeeName: string;
  quantity: number;
  revenue: number;
  productCount: number;
}

export function buildCustomGroupDayDetails(
  group: CustomProductGroup,
  lines: SkuSalesLine[],
  employeeName?: string,
): CustomGroupDayDetail[] {
  const codeSet = new Set(group.productCodes);
  const byDate = new Map<
    string,
    Map<string, { productName: string; quantity: number; revenue: number }>
  >();

  for (const line of lines) {
    if (!codeSet.has(line.productCode)) continue;
    if (employeeName != null && !employeeNamesMatch(line.employeeName, employeeName)) continue;
    let products = byDate.get(line.date);
    if (!products) {
      products = new Map();
      byDate.set(line.date, products);
    }
    const prev = products.get(line.productCode) ?? {
      productName: line.productName,
      quantity: 0,
      revenue: 0,
    };
    prev.quantity += line.quantity;
    prev.revenue += line.revenue;
    if (line.productName) prev.productName = line.productName;
    products.set(line.productCode, prev);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, products]) => {
      const list = [...products.entries()]
        .map(([productCode, v]) => ({
          productCode,
          productName: v.productName,
          quantity: v.quantity,
          revenue: v.revenue,
        }))
        .sort((a, b) => b.quantity - a.quantity || a.productCode.localeCompare(b.productCode));
      return {
        date,
        products: list.map((p, idx) => ({ stt: idx + 1, ...p })),
        quantityTotal: list.reduce((s, p) => s + p.quantity, 0),
        revenueTotal: list.reduce((s, p) => s + p.revenue, 0),
      };
    });
}

export interface EmployeeCustomGroupSummary {
  group: CustomProductGroup;
  quantity: number;
  revenue: number;
  productCount: number;
  days: CustomGroupDayDetail[];
}

export function buildEmployeeCustomGroupSummaries(
  employeeName: string,
  groups: CustomProductGroup[],
  lines: SkuSalesLine[],
): EmployeeCustomGroupSummary[] {
  return groups
    .map((group) => {
      const days = buildCustomGroupDayDetails(group, lines, employeeName);
      const codes = new Set<string>();
      let quantity = 0;
      let revenue = 0;
      for (const day of days) {
        quantity += day.quantityTotal;
        revenue += day.revenueTotal;
        for (const p of day.products) codes.add(p.productCode);
      }
      return {
        group,
        quantity,
        revenue,
        productCount: codes.size,
        days,
      };
    })
    .sort((a, b) => b.quantity - a.quantity || a.group.name.localeCompare(b.group.name, "vi"));
}

export function buildCustomGroupEmployeeSummaries(
  group: CustomProductGroup,
  lines: SkuSalesLine[],
): CustomGroupEmployeeSummary[] {
  const codeSet = new Set(group.productCodes);
  const byEmp = new Map<
    string,
    { quantity: number; revenue: number; codes: Set<string> }
  >();

  for (const line of lines) {
    if (!codeSet.has(line.productCode)) continue;
    const prev = byEmp.get(line.employeeName) ?? {
      quantity: 0,
      revenue: 0,
      codes: new Set<string>(),
    };
    prev.quantity += line.quantity;
    prev.revenue += line.revenue;
    prev.codes.add(line.productCode);
    byEmp.set(line.employeeName, prev);
  }

  return [...byEmp.entries()]
    .map(([employeeName, v]) => ({
      employeeName,
      quantity: v.quantity,
      revenue: v.revenue,
      productCount: v.codes.size,
    }))
    .sort((a, b) => b.quantity - a.quantity || a.employeeName.localeCompare(b.employeeName, "vi"));
}
