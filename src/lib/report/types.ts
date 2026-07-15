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
  quantity: number;
  goldWeight: number;
  revenue: number;
}

export interface TargetColumn {
  key: string;
  label: string;
  kind: "dt" | "sl" | "other";
}

export interface TargetData {
  columns: TargetColumn[];
  /** Month totals keyed by column key (from TỔNG row) */
  monthTotals: Record<string, number>;
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
