export type ColumnDtype = "string" | "number" | "float" | "date" | "boolean";
export type DateGranularity = "day" | "week" | "month";

export interface ColumnInfo {
  name: string;
  dtype: ColumnDtype;
  original_name: string;
}

export interface DatasetMeta {
  dataset_id: string;
  filename: string;
  row_count: number;
  column_count: number;
  columns: ColumnInfo[];
  created_at: string;
  sheet?: string | null;
}

export interface UploadResponse {
  dataset_id: string;
  meta: DatasetMeta;
  preview: Record<string, unknown>[];
}

export interface ColumnValueItem {
  key: string;
  label: string;
  row_count: number;
}

export interface ColumnValuesResponse {
  values: ColumnValueItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SummarySegment {
  key: string;
  label: string;
  values: Record<string, number | null>;
  row_count: number;
}

export interface SummaryTab {
  key: string;
  label: string;
  row_count: number;
  segments: SummarySegment[];
}

export interface SummaryResponse {
  tabs: SummaryTab[];
  total_tabs: number;
}

export interface DetailResponse {
  rows: Record<string, unknown>[];
  total_rows: number;
  limit: number;
  offset: number;
}

export interface SavedConfig {
  primaryGroupColumn: string | null;
  secondaryGroupColumns: string[];
  selectedValuesByColumn: Record<string, string[]>;
  sumColumns: string[];
  dateGranularity: Record<string, DateGranularity>;
  tabRenames: Record<string, string>;
}
