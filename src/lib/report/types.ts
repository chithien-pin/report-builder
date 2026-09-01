export type SlUnit = "chi" | "chiec";

export interface ReportGroup {
  id: string;
  name: string;
  /** Dòng sản phẩm mapped into this group */
  productLines: string[];
  /** How to measure sản lượng for this group */
  slUnit: SlUnit;
  /** Target CSV column key for doanh thu tháng (optional) */
  targetDtColumn: string | null;
  /** Target CSV column key for sản lượng tháng (optional) */
  targetSlColumn: string | null;
}

export interface GroupConfig {
  groups: ReportGroup[];
  /** Unmapped product lines go to this group id, or null to exclude */
  fallbackGroupId: string | null;
}

export interface SalesRow {
  date: string; // YYYY-MM-DD
  productLine: string;
  productCategory: string;
  employeeName: string;
  orderId: string | null;
  /** Mã hàng (MA HANG) */
  productCode: string;
  /** Tên sản phẩm / tên hàng */
  productName: string;
  quantity: number;
  goldWeight: number;
  grossAmount: number;
  netRevenue: number;
  revenue: number;
  grossProfit: number;
}

export interface TargetColumn {
  key: string;
  label: string;
  kind: "dt" | "sl" | "other";
}

export interface TargetWeekPeriod {
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  pct: number;
  days: number;
}

export interface TargetData {
  columns: TargetColumn[];
  /** Month totals keyed by column key (from TỔNG row) */
  monthTotals: Record<string, number>;
  /** Custom week buckets with explicit date ranges (not calendar weeks). */
  weekPeriods: TargetWeekPeriod[];
  /** Plan month YYYY-MM inferred from filename or sheet. */
  planMonth: string;
  /** Per-employee plan from target file (DT kế hoạch + SL tính lương). */
  employeePlans: EmployeeTargetPlan[];
}

export interface EmployeeTargetPlan {
  code: string;
  name: string;
  dtPlan: number;
  slPayroll: number;
  dtBreakdown: { label: string; value: number }[];
  slBreakdown: { label: string; value: number }[];
}

export interface EmployeeTargetBreakdownRow {
  label: string;
  dtActual: number;
  dtPlan: number;
  slActual: number;
  slPlan: number;
}

export interface EmployeeTargetDetail {
  name: string;
  code: string | null;
  asOfDate: string;
  dtActual: number;
  dtPlan: number;
  dtPct: number | null;
  dtRemaining: number;
  slActual: number;
  slPlan: number;
  slPct: number | null;
  slRemaining: number;
  breakdown: EmployeeTargetBreakdownRow[];
  suggestions: string[];
}

/** Persisted monthly target (reusable across sales uploads) */
export interface PersistedTarget {
  filename: string;
  updatedAt: string;
  target: TargetData;
}

export interface SavedTargetMeta {
  filename: string;
  updatedAt: string;
  columns: TargetColumn[];
}

export interface MetricActual {
  actual: number;
  target: number;
  pct: number | null;
  cumulativeActual: number;
  cumulativeTarget: number;
  cumulativePct: number | null;
  monthTarget: number;
  monthPct: number | null;
  remaining: number;
}

export interface GroupDayMetrics {
  groupId: string;
  groupName: string;
  sl: MetricActual;
  dt: MetricActual;
}

export interface DayReport {
  date: string;
  groups: GroupDayMetrics[];
  total: GroupDayMetrics;
}

export interface DailyCompactRow {
  date: string;
  slActual: number;
  slTarget: number;
  slPct: number | null;
  dtActual: number;
  dtTarget: number;
  dtPct: number | null;
}

export interface MonthKpiSummary {
  slActual: number;
  slTarget: number;
  slPct: number | null;
  dtActual: number;
  dtTarget: number;
  dtPct: number | null;
  asOfDate: string;
}

export interface CategoryBreakdownRow {
  category: string;
  revenue: number;
  sharePct: number;
  orderCount: number;
  grossProfit: number;
  cumulativeRevenue: number;
  monthTarget: number;
  /** DT lũy kế / chỉ tiêu tháng */
  cumulativePct: number | null;
  goldWeight: number;
  quantity: number;
  slUnit: "chi" | "piece";
  hideSl: boolean;
  cumulativeSl: number;
  slMonthTarget: number;
  /** SL lũy kế / chỉ tiêu SL tháng */
  cumulativeSlPct: number | null;
}

export interface CategoryBreakdown {
  grossTotal: number;
  netRevenue: number;
  variancePct: number | null;
  goldWeightTotal: number;
  quantityTotal: number;
  asOfDate: string;
  cumulativeRevenue: number;
  monthTarget: number;
  /** DT lũy kế / chỉ tiêu tháng */
  cumulativePct: number | null;
  cumulativeGoldWeight: number;
  slMonthTarget: number;
  cumulativeSlPct: number | null;
  categories: CategoryBreakdownRow[];
}

export interface EmployeePerformanceRow {
  name: string;
  revenue: number;
  revenueSharePct: number;
  orderCount: number;
  orderSharePct: number;
  aov: number;
  itemsPerOrder: number;
  grossProfit: number;
  marginPct: number;
  revenueRatio: number;
  orderRatio: number;
}

export type EmployeeInsightKind =
  | "top-upsell"
  | "balanced"
  | "high-margin"
  | "needs-support";

export interface EmployeeInsight {
  kind: EmployeeInsightKind;
  name: string;
  revenueRatio: number;
  orderRatio: number;
  marginPct?: number;
  aov?: number;
  caption: string;
  medal?: "gold" | "silver";
}

export interface EmployeePerformance {
  employees: EmployeePerformanceRow[];
  insights: EmployeeInsight[];
  targetDetails: EmployeeTargetDetail[];
  asOfDate: string;
}

export const SALES_SCHEMA_VERSION = 4;

export interface ReportDatasetMeta {
  datasetId: string;
  salesFilename: string;
  targetFilename: string;
  rowCount: number;
  dates: string[];
  productLines: string[];
  targetColumns: TargetColumn[];
  storeCode: string | null;
  createdAt: string;
  salesSchemaVersion?: number;
}

export interface ReportDataset {
  meta: ReportDatasetMeta;
  sales: SalesRow[];
  target: TargetData;
  groupConfig: GroupConfig;
}

export interface UploadReportResponse {
  datasetId: string;
  meta: ReportDatasetMeta;
  groupConfig: GroupConfig;
}

/** Nhóm sản phẩm custom theo MA HANG (persist client). */
export interface CustomProductGroup {
  id: string;
  name: string;
  productCodes: string[];
  dtPlan: number;
  slPlan: number;
}

export interface ProductCatalogItem {
  code: string;
  name: string;
}

/** Dòng bán theo mã hàng (phục vụ nhóm custom + popup detail). */
export interface SkuSalesLine {
  date: string;
  productCode: string;
  productName: string;
  employeeName: string;
  quantity: number;
  revenue: number;
}

export type StoreLevel = 1 | 2 | 3 | 4 | 5;

export type CommissionGroupKey = "tich-tru" | "ts24k" | "ts-khac";

export type CommissionRole = "tvv" | "cht" | "cashier";

export interface CommissionLevelRates {
  /** VND / chỉ */
  tichTru: number;
  /** VND / chỉ */
  ts24k: number;
  /** Phần trăm hoa hồng, ví dụ 0.18 = 0.18% */
  tsKhacPct: number;
}

export interface CommissionRates {
  cht: Record<StoreLevel, CommissionLevelRates>;
  tvv: Record<StoreLevel, CommissionLevelRates>;
  cashier: Record<StoreLevel, number>;
}

export interface CommissionConfig {
  storeLevel: StoreLevel;
  chtName: string;
  chtTrainee: boolean;
  cashierName: string;
  tvvLevels: Record<string, StoreLevel>;
  rates: CommissionRates;
}

export interface CommissionGroupLine {
  key: CommissionGroupKey;
  label: string;
  actual: number;
  plan: number;
  pct: number | null;
  eligible: boolean;
  overPlan: boolean;
  amount: number;
  unit: "chi" | "vnd";
}

export interface CommissionPersonRow {
  role: CommissionRole;
  name: string;
  level: StoreLevel;
  groups: CommissionGroupLine[];
  total: number;
  eligible: boolean;
  note: string;
}

export interface CommissionForecast {
  asOfDate: string;
  tvv: CommissionPersonRow[];
  cht: CommissionPersonRow | null;
  cashier: CommissionPersonRow | null;
  grandTotal: number;
}
