import type {
  DailyCompactRow,
  DayReport,
  GroupConfig,
  ReportDatasetMeta,
  SavedTargetMeta,
  UploadReportResponse,
} from "@/lib/report/types";

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? res.statusText;
  } catch {
    return res.statusText || "Request failed";
  }
}

export async function fetchSavedTarget(): Promise<SavedTargetMeta | null> {
  const res = await fetch("/api/report/target");
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { savedTarget: SavedTargetMeta | null };
  return body.savedTarget;
}

export async function uploadTargetFile(
  target: File,
  datasetId?: string | null,
): Promise<{
  savedTarget: SavedTargetMeta;
  meta: ReportDatasetMeta | null;
  groupConfig: GroupConfig | null;
}> {
  const form = new FormData();
  form.append("target", target);
  if (datasetId) form.append("datasetId", datasetId);

  const res = await fetch("/api/report/target", { method: "POST", body: form });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    savedTarget: SavedTargetMeta;
    meta: ReportDatasetMeta | null;
    groupConfig: GroupConfig | null;
  };
}

export async function uploadReportFiles(
  sales: File,
  target?: File | null,
  groupConfig?: GroupConfig | null,
): Promise<UploadReportResponse & { savedTarget: SavedTargetMeta | null }> {
  const form = new FormData();
  form.append("sales", sales);
  if (target) form.append("target", target);
  if (groupConfig) form.append("groupConfig", JSON.stringify(groupConfig));

  const res = await fetch("/api/report/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as UploadReportResponse & {
    savedTarget: SavedTargetMeta | null;
  };
}

export async function fetchDayReport(
  datasetId: string,
  date?: string | null,
): Promise<{ meta: ReportDatasetMeta; groupConfig: GroupConfig; report: DayReport }> {
  const params = new URLSearchParams({ datasetId, mode: "day" });
  if (date) params.set("date", date);
  const res = await fetch(`/api/report/summary?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    meta: ReportDatasetMeta;
    groupConfig: GroupConfig;
    report: DayReport;
  };
}

export async function fetchDailySeries(
  datasetId: string,
): Promise<{ meta: ReportDatasetMeta; groupConfig: GroupConfig; series: DailyCompactRow[] }> {
  const params = new URLSearchParams({ datasetId, mode: "series" });
  const res = await fetch(`/api/report/summary?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    meta: ReportDatasetMeta;
    groupConfig: GroupConfig;
    series: DailyCompactRow[];
  };
}

export async function saveGroupConfig(
  datasetId: string,
  groupConfig: GroupConfig,
  date?: string | null,
): Promise<{ meta: ReportDatasetMeta; groupConfig: GroupConfig; report: DayReport | null }> {
  const res = await fetch("/api/report/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datasetId, groupConfig, date }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    meta: ReportDatasetMeta;
    groupConfig: GroupConfig;
    report: DayReport | null;
  };
}
