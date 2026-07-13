import type {
  ColumnValuesResponse,
  DateGranularity,
  DetailResponse,
  SummaryResponse,
  SummaryTab,
  UploadResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) {
        message = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResponse>("/api/upload", { method: "POST", body: form });
}

export async function importGoogleSheet(url: string): Promise<UploadResponse> {
  return request<UploadResponse>("/api/gsheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export async function fetchColumnValues(params: {
  datasetId: string;
  filterColumn: string;
  dateGranularity?: DateGranularity | null;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ColumnValuesResponse> {
  return request<ColumnValuesResponse>("/api/values", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: params.datasetId,
      filter_column: params.filterColumn,
      date_granularity: params.dateGranularity ?? null,
      search: params.search ?? "",
      limit: params.limit ?? 200,
      offset: params.offset ?? 0,
    }),
  });
}

export async function fetchSummary(params: {
  datasetId: string;
  primaryGroupColumn: string;
  secondaryGroupColumns: string[];
  selectedValuesByColumn: Record<string, string[]>;
  sumColumns: string[];
  dateGranularity?: Record<string, DateGranularity>;
}): Promise<SummaryResponse> {
  return request<SummaryResponse>("/api/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: params.datasetId,
      primary_column: params.primaryGroupColumn,
      secondary_columns: params.secondaryGroupColumns,
      selected_values: params.selectedValuesByColumn,
      sum_columns: params.sumColumns,
      date_granularity: params.dateGranularity ?? {},
    }),
  });
}

export async function fetchDetail(params: {
  datasetId: string;
  primaryGroupColumn: string;
  secondaryGroupColumns: string[];
  primaryValue: string;
  selectedValuesByColumn?: Record<string, string[]>;
  segmentKey?: string | null;
  dateGranularity?: Record<string, DateGranularity>;
  limit?: number;
  offset?: number;
}): Promise<DetailResponse> {
  return request<DetailResponse>("/api/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: params.datasetId,
      primary_column: params.primaryGroupColumn,
      secondary_columns: params.secondaryGroupColumns,
      primary_value: params.primaryValue,
      segment_key: params.segmentKey ?? null,
      selected_values: params.selectedValuesByColumn ?? {},
      date_granularity: params.dateGranularity ?? {},
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    }),
  });
}
