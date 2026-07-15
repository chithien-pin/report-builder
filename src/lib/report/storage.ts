import { mkdir, readFile, writeFile, access } from "fs/promises";
import { constants } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

import { list, put } from "@vercel/blob";

import { createDefaultGroupConfig } from "./preset";
import { parseSalesBuffer, parseTargetBuffer } from "./parse";
import type {
  GroupConfig,
  PersistedTarget,
  ReportDataset,
  ReportDatasetMeta,
  TargetData,
} from "./types";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN ?? "";
const USE_BLOB = Boolean(BLOB_TOKEN);
const PERSISTED_TARGET_ID = "persisted-target";

function isServerless(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    process.cwd().startsWith("/var/task")
  );
}

function resolveLocalCacheDir(): string {
  if (isServerless()) return path.join(os.tmpdir(), "reportbtmh-cache");
  return path.join(process.cwd(), ".cache");
}

const LOCAL_CACHE = resolveLocalCacheDir();

function blobKey(datasetId: string) {
  return `reports/${datasetId}.json`;
}

function targetBlobKey() {
  return `targets/${PERSISTED_TARGET_ID}.json`;
}

function localPath(datasetId: string) {
  return path.join(LOCAL_CACHE, `report-${datasetId}.json`);
}

function localTargetPath() {
  return path.join(LOCAL_CACHE, `${PERSISTED_TARGET_ID}.json`);
}

async function ensureCache() {
  await mkdir(LOCAL_CACHE, { recursive: true });
}

function assertBlobOnVercel() {
  if (isServerless() && !USE_BLOB) {
    throw new Error(
      "Thiếu BLOB_READ_WRITE_TOKEN. Trên Vercel cần Blob Store + env BLOB_READ_WRITE_TOKEN.",
    );
  }
}

async function writeJsonBlob(key: string, payload: string) {
  await put(key, payload, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
}

async function readJsonBlob(key: string): Promise<unknown | null> {
  const { blobs } = await list({ prefix: key, limit: 5, token: BLOB_TOKEN });
  const hit = blobs.find((b) => b.pathname === key);
  if (!hit) return null;
  const res = await fetch(hit.url);
  if (!res.ok) return null;
  return res.json();
}

export async function savePersistedTarget(
  target: TargetData,
  filename: string,
): Promise<PersistedTarget> {
  assertBlobOnVercel();
  const persisted: PersistedTarget = {
    filename,
    updatedAt: new Date().toISOString(),
    target,
  };
  const payload = JSON.stringify(persisted);

  if (USE_BLOB) {
    await writeJsonBlob(targetBlobKey(), payload);
  } else {
    await ensureCache();
    await writeFile(localTargetPath(), payload, "utf-8");
  }

  return persisted;
}

export async function loadPersistedTarget(): Promise<PersistedTarget | null> {
  if (USE_BLOB) {
    const data = await readJsonBlob(targetBlobKey());
    return (data as PersistedTarget | null) ?? null;
  }

  try {
    const raw = await readFile(localTargetPath(), "utf-8");
    return JSON.parse(raw) as PersistedTarget;
  } catch {
    return null;
  }
}

export async function saveReportDataset(dataset: ReportDataset): Promise<void> {
  assertBlobOnVercel();
  const payload = JSON.stringify(dataset);

  if (USE_BLOB) {
    await writeJsonBlob(blobKey(dataset.meta.datasetId), payload);
    return;
  }

  await ensureCache();
  await writeFile(localPath(dataset.meta.datasetId), payload, "utf-8");
}

export async function loadReportDataset(datasetId: string): Promise<ReportDataset> {
  if (USE_BLOB) {
    const data = await readJsonBlob(blobKey(datasetId));
    if (!data) throw new Error(`Dataset '${datasetId}' not found`);
    return data as ReportDataset;
  }

  try {
    const raw = await readFile(localPath(datasetId), "utf-8");
    return JSON.parse(raw) as ReportDataset;
  } catch {
    throw new Error(`Dataset '${datasetId}' not found. Vui lòng upload lại.`);
  }
}

export async function reportDatasetExists(datasetId: string): Promise<boolean> {
  try {
    if (USE_BLOB) {
      return Boolean(await readJsonBlob(blobKey(datasetId)));
    }
    await access(localPath(datasetId), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function createReportDataset(opts: {
  salesBuffer: Buffer;
  salesFilename: string;
  targetBuffer?: Buffer | null;
  targetFilename?: string | null;
  groupConfig?: GroupConfig | null;
}): Promise<ReportDataset> {
  const salesParsed = parseSalesBuffer(opts.salesBuffer, opts.salesFilename);

  let target: TargetData;
  let targetFilename: string;

  if (opts.targetBuffer && opts.targetFilename) {
    target = parseTargetBuffer(opts.targetBuffer, opts.targetFilename);
    targetFilename = opts.targetFilename;
    await savePersistedTarget(target, targetFilename);
  } else {
    const saved = await loadPersistedTarget();
    if (!saved) {
      throw new Error("Chưa có file chỉ tiêu. Vui lòng upload file target.");
    }
    target = saved.target;
    targetFilename = saved.filename;
  }

  const config = opts.groupConfig ?? createDefaultGroupConfig(target.columns);
  const datasetId = randomUUID();

  const meta: ReportDatasetMeta = {
    datasetId,
    salesFilename: opts.salesFilename,
    targetFilename,
    rowCount: salesParsed.rows.length,
    dates: salesParsed.dates,
    productLines: salesParsed.productLines,
    targetColumns: target.columns,
    storeCode: salesParsed.storeCode,
    createdAt: new Date().toISOString(),
  };

  const dataset: ReportDataset = {
    meta,
    sales: salesParsed.rows,
    target,
    groupConfig: config,
  };

  await saveReportDataset(dataset);
  return dataset;
}

export async function replacePersistedTarget(
  targetBuffer: Buffer,
  targetFilename: string,
  datasetId?: string | null,
): Promise<{ persisted: PersistedTarget; dataset: ReportDataset | null }> {
  const target = parseTargetBuffer(targetBuffer, targetFilename);
  const persisted = await savePersistedTarget(target, targetFilename);

  if (!datasetId) {
    return { persisted, dataset: null };
  }

  const dataset = await loadReportDataset(datasetId);
  dataset.target = target;
  dataset.meta.targetFilename = targetFilename;
  dataset.meta.targetColumns = target.columns;
  dataset.groupConfig = createDefaultGroupConfig(target.columns);
  await saveReportDataset(dataset);
  return { persisted, dataset };
}

export async function updateGroupConfig(
  datasetId: string,
  groupConfig: GroupConfig,
): Promise<ReportDataset> {
  const dataset = await loadReportDataset(datasetId);
  dataset.groupConfig = groupConfig;
  await saveReportDataset(dataset);
  return dataset;
}
