import { RevConflict } from "@/lib/check-stock/types";
import type {
  DatasetFile,
  DatasetMeta,
  DatasetsIndex,
  LinesFile,
  SessionDoc,
  SessionListItem,
} from "@/lib/check-stock/types";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as { error?: string; current?: unknown };
  if (response.status === 409) throw new RevConflict(body.current);
  if (!response.ok) throw new ApiError(response.status, body.error || `Lỗi ${response.status}`);
  return body as T;
}

export const stockApi = {
  lines() {
    return request<LinesFile>("/api/check-stock/lines");
  },
  saveLines(lines: LinesFile["lines"], qtyTolerance: number, baseRev: number) {
    return request<LinesFile>("/api/check-stock/lines", {
      method: "PUT",
      body: JSON.stringify({ lines, qtyTolerance, baseRev }),
    });
  },
  datasets() {
    return request<DatasetsIndex>("/api/check-stock/datasets");
  },
  async dataset(id: string) {
    const located = await request<{ file?: DatasetFile; url?: string }>(`/api/check-stock/datasets/${id}`);
    if (located.file) return located.file;
    if (!located.url) throw new ApiError(404, "Không thấy dataset.");
    const response = await fetch(located.url, { cache: "no-store" });
    if (!response.ok) throw new ApiError(response.status, "Không đọc được dataset.");
    return (await response.json()) as DatasetFile;
  },
  async saveDataset(file: DatasetFile, meta: DatasetMeta, activate: boolean) {
    const payload = JSON.stringify(file);
    const mode = await request<{ mode: "blob" | "local" }>("/api/check-stock/upload");
    if (mode.mode === "blob") {
      const { upload } = await import("@vercel/blob/client");
      await upload(`check-stock/datasets/${file.id}.json`, new Blob([payload], { type: "application/json" }), {
        access: "public",
        handleUploadUrl: "/api/check-stock/upload",
        contentType: "application/json",
        multipart: new Blob([payload]).size > 4 * 1024 * 1024,
      });
    } else {
      await request(`/api/check-stock/datasets/${file.id}/body`, { method: "PUT", body: payload });
    }
    const index = await this.datasets();
    try {
      return await request<DatasetsIndex>("/api/check-stock/datasets", {
        method: "POST",
        body: JSON.stringify({ baseRev: index.rev, meta, activate }),
      });
    } catch (error) {
      if (!(error instanceof RevConflict)) throw error;
      const current = error.current as DatasetsIndex;
      return request<DatasetsIndex>("/api/check-stock/datasets", {
        method: "POST",
        body: JSON.stringify({ baseRev: current.rev, meta, activate }),
      });
    }
  },
  activateDataset(id: string, baseRev: number) {
    return request<DatasetsIndex>("/api/check-stock/datasets/active", {
      method: "POST",
      body: JSON.stringify({ id, baseRev }),
    });
  },
  sessions() {
    return request<{ items: SessionListItem[] }>("/api/check-stock/sessions");
  },
  async session(category: string, key: string) {
    const response = await fetch(`/api/check-stock/sessions/${category}/${encodeURIComponent(key)}`, { cache: "no-store" });
    if (response.status === 404) return null;
    const body = (await response.json().catch(() => ({}))) as SessionDoc & { error?: string };
    if (!response.ok) throw new ApiError(response.status, body.error || `Lỗi ${response.status}`);
    return body;
  },
  saveSession(category: string, key: string, doc: SessionDoc, baseRev: number) {
    return request<SessionDoc>(`/api/check-stock/sessions/${category}/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ baseRev, doc }),
    });
  },
};
