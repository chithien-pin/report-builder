import { mkdir, readFile, writeFile, access } from "fs/promises";
import { constants } from "fs";
import os from "os";
import path from "path";

import { list, put } from "@vercel/blob";

import type { DatasetMeta } from "@/lib/types";

type StoredMeta = DatasetMeta & { parquet_url?: string };

const BLOB_TOKEN = process.env.BLOB_STORE_ID_READ_WRITE_TOKEN ?? "";
const USE_BLOB = Boolean(BLOB_TOKEN);

function isServerless(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    process.cwd().startsWith("/var/task")
  );
}

/** Vercel/Lambda: chỉ ghi được /tmp. Local: .cache trong project. */
function resolveLocalCacheDir(): string {
  if (isServerless()) {
    return path.join(os.tmpdir(), "reportbtmh-cache");
  }
  return path.join(process.cwd(), ".cache");
}

const LOCAL_CACHE = resolveLocalCacheDir();
const TMP = os.tmpdir();

function parquetBlobKey(datasetId: string) {
  return `datasets/${datasetId}.parquet`;
}

function metaBlobKey(datasetId: string) {
  return `datasets/${datasetId}.meta.json`;
}

function localParquetPath(datasetId: string) {
  return path.join(LOCAL_CACHE, `${datasetId}.parquet`);
}

function localMetaPath(datasetId: string) {
  return path.join(LOCAL_CACHE, `${datasetId}.meta.json`);
}

async function ensureLocalCache() {
  await mkdir(LOCAL_CACHE, { recursive: true });
}

async function getBlobUrl(pathname: string): Promise<string | null> {
  const { blobs } = await list({
    prefix: pathname,
    limit: 20,
    token: BLOB_TOKEN,
  });
  const hit = blobs.find((b) => b.pathname === pathname);
  return hit?.url ?? null;
}

function assertBlobOnVercel() {
  if (isServerless() && !USE_BLOB) {
    throw new Error(
      "Thiếu BLOB_STORE_ID_READ_WRITE_TOKEN. Trên Vercel bắt buộc tạo Blob Store và thêm env BLOB_STORE_ID_READ_WRITE_TOKEN, rồi Redeploy.",
    );
  }
}

export async function saveDataset(
  datasetId: string,
  parquetBuffer: Buffer,
  meta: DatasetMeta,
): Promise<void> {
  assertBlobOnVercel();

  if (USE_BLOB) {
    const parquet = await put(parquetBlobKey(datasetId), parquetBuffer, {
      access: "public",
      contentType: "application/octet-stream",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: BLOB_TOKEN,
    });
    const stored: StoredMeta = { ...meta, parquet_url: parquet.url };
    await put(metaBlobKey(datasetId), JSON.stringify(stored, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: BLOB_TOKEN,
    });
    return;
  }

  await ensureLocalCache();
  await writeFile(localParquetPath(datasetId), parquetBuffer);
  await writeFile(localMetaPath(datasetId), JSON.stringify(meta, null, 2), "utf-8");
}

export async function loadMeta(datasetId: string): Promise<StoredMeta> {
  if (USE_BLOB) {
    const url = await getBlobUrl(metaBlobKey(datasetId));
    if (!url) {
      throw new Error(
        `Dataset '${datasetId}' not found (Blob). Upload lại file hoặc kiểm tra BLOB_STORE_ID_READ_WRITE_TOKEN.`,
      );
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Dataset '${datasetId}' not found`);
    return (await res.json()) as StoredMeta;
  }

  try {
    const raw = await readFile(localMetaPath(datasetId), "utf-8");
    return JSON.parse(raw) as StoredMeta;
  } catch {
    throw new Error(
      `Dataset '${datasetId}' not found. Trên Vercel cần Blob Store — upload lại sau khi cấu hình BLOB_STORE_ID_READ_WRITE_TOKEN.`,
    );
  }
}

export async function datasetExists(datasetId: string): Promise<boolean> {
  try {
    if (USE_BLOB) {
      const url = await getBlobUrl(metaBlobKey(datasetId));
      return Boolean(url);
    }
    await access(localParquetPath(datasetId), constants.F_OK);
    await access(localMetaPath(datasetId), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Returns a local filesystem path DuckDB can read (downloads from Blob to /tmp if needed). */
export async function resolveParquetPath(datasetId: string): Promise<string> {
  if (!USE_BLOB) {
    const p = localParquetPath(datasetId);
    try {
      await access(p, constants.F_OK);
      return p;
    } catch {
      throw new Error(`Dataset '${datasetId}' not found`);
    }
  }

  const meta = await loadMeta(datasetId);
  if (!meta.parquet_url) throw new Error(`Dataset '${datasetId}' not found`);

  const tmpPath = path.join(TMP, `reportbtmh-${datasetId}.parquet`);
  const res = await fetch(meta.parquet_url);
  if (!res.ok) throw new Error(`Failed to download dataset '${datasetId}'`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(tmpPath, buf);
  return tmpPath;
}

export function isBlobStorageEnabled() {
  return USE_BLOB;
}
