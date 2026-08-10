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
import { SALES_SCHEMA_VERSION } from "./types";
import { normalizeTargetWeekPeriods } from "./week-periods";

function normalizeTarget(target: TargetData, filename: string): TargetData {
  const { planMonth, weekPeriods } = normalizeTargetWeekPeriods(
    target.weekPeriods,
    target.planMonth,
    filename,
  );
  return {
    ...target,
    planMonth,
    weekPeriods,
    employeePlans: target.employeePlans ?? [],
  };
}

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

function targetJsonBlobKey() {
  return `targets/${PERSISTED_TARGET_ID}.json`;
}

function targetSourceBlobKey() {
  return `targets/${PERSISTED_TARGET_ID}.bin`;
}

function localPath(datasetId: string) {
  return path.join(LOCAL_CACHE, `report-${datasetId}.json`);
}

function localSalesPath(datasetId: string) {
  return path.join(LOCAL_CACHE, `report-${datasetId}-sales.bin`);
}

function localTargetPath() {
  return path.join(LOCAL_CACHE, `${PERSISTED_TARGET_ID}.json`);
}

function localTargetBlobPath() {
  return path.join(LOCAL_CACHE, `${PERSISTED_TARGET_ID}.bin`);
}

async function writeTargetBlob(buffer: Buffer) {
  if (USE_BLOB) {
    await put(targetSourceBlobKey(), buffer, {
      access: "public",
      contentType: "application/octet-stream",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: BLOB_TOKEN,
    });
    return;
  }
  await ensureCache();
  await writeFile(localTargetBlobPath(), buffer);
}

async function readTargetBlob(): Promise<Buffer | null> {
  if (USE_BLOB) {
    const { blobs } = await list({ prefix: targetSourceBlobKey(), limit: 5, token: BLOB_TOKEN });
    const hit = blobs.find((b) => b.pathname === targetSourceBlobKey());
    if (!hit) return null;
    const res = await fetch(hit.url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  try {
    return await readFile(localTargetBlobPath());
  } catch {
    return null;
  }
}

async function maybeRefreshTarget(dataset: ReportDataset): Promise<ReportDataset> {
  if ((dataset.target.employeePlans?.length ?? 0) > 0) return dataset;
  const targetBuffer = await readTargetBlob();
  if (!targetBuffer) return dataset;
  const parsed = parseTargetBuffer(targetBuffer, dataset.meta.targetFilename);
  if ((parsed.employeePlans?.length ?? 0) === 0) return dataset;
  dataset.target = normalizeTarget(
    { ...dataset.target, employeePlans: parsed.employeePlans },
    dataset.meta.targetFilename,
  );
  await saveReportDataset(dataset);
  await savePersistedTarget(dataset.target, dataset.meta.targetFilename);
  return dataset;
}

function salesBlobKey(datasetId: string) {
  return `reports/${datasetId}-sales.bin`;
}

async function writeSalesBlob(datasetId: string, buffer: Buffer) {
  if (USE_BLOB) {
    await put(salesBlobKey(datasetId), buffer, {
      access: "public",
      contentType: "application/octet-stream",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: BLOB_TOKEN,
    });
    return;
  }
  await ensureCache();
  await writeFile(localSalesPath(datasetId), buffer);
}

async function readSalesBlob(datasetId: string): Promise<Buffer | null> {
  if (USE_BLOB) {
    const { blobs } = await list({ prefix: salesBlobKey(datasetId), limit: 5, token: BLOB_TOKEN });
    const hit = blobs.find((b) => b.pathname === salesBlobKey(datasetId));
    if (!hit) return null;
    const res = await fetch(hit.url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  try {
    return await readFile(localSalesPath(datasetId));
  } catch {
    return null;
  }
}

function salesNeedsReparsing(dataset: ReportDataset): boolean {
  const version = dataset.meta.salesSchemaVersion ?? 1;
  if (version >= SALES_SCHEMA_VERSION) return false;
  if (dataset.sales.length === 0) return false;
  const sample = dataset.sales[0];
  if (!("productCategory" in sample)) return true;
  const categories = new Set(dataset.sales.map((r) => r.productCategory));
  const lines = new Set(dataset.sales.map((r) => r.productLine));
  return categories.size === 1 && categories.has("Khác") && lines.size > 2;
}

async function maybeRefreshSales(dataset: ReportDataset): Promise<ReportDataset> {
  if (!salesNeedsReparsing(dataset)) return dataset;
  const salesBuffer = await readSalesBlob(dataset.meta.datasetId);
  if (!salesBuffer) return dataset;
  return refreshSalesFromSource(dataset, salesBuffer);
}

async function refreshSalesFromSource(
  dataset: ReportDataset,
  salesBuffer: Buffer,
): Promise<ReportDataset> {
  const salesParsed = parseSalesBuffer(salesBuffer, dataset.meta.salesFilename);
  dataset.sales = salesParsed.rows;
  dataset.meta.rowCount = salesParsed.rows.length;
  dataset.meta.dates = salesParsed.dates;
  dataset.meta.productLines = salesParsed.productLines;
  dataset.meta.storeCode = salesParsed.storeCode;
  dataset.meta.salesSchemaVersion = SALES_SCHEMA_VERSION;
  await saveReportDataset(dataset);
  return dataset;
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
    target: normalizeTarget(target, filename),
  };
  const payload = JSON.stringify(persisted);

  if (USE_BLOB) {
    await writeJsonBlob(targetJsonBlobKey(), payload);
  } else {
    await ensureCache();
    await writeFile(localTargetPath(), payload, "utf-8");
  }

  return persisted;
}

async function savePersistedTargetWithBuffer(
  target: TargetData,
  filename: string,
  targetBuffer?: Buffer | null,
): Promise<PersistedTarget> {
  const persisted = await savePersistedTarget(target, filename);
  if (targetBuffer) {
    await writeTargetBlob(targetBuffer);
  }
  return persisted;
}

export async function loadPersistedTarget(): Promise<PersistedTarget | null> {
  if (USE_BLOB) {
    const data = await readJsonBlob(targetJsonBlobKey());
    const parsed = (data as PersistedTarget | null) ?? null;
    if (!parsed) return null;
    return {
      ...parsed,
      target: normalizeTarget(parsed.target, parsed.filename),
    };
  }

  try {
    const raw = await readFile(localTargetPath(), "utf-8");
    const parsed = JSON.parse(raw) as PersistedTarget;
    return {
      ...parsed,
      target: normalizeTarget(parsed.target, parsed.filename),
    };
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
  let dataset: ReportDataset;

  if (USE_BLOB) {
    const data = await readJsonBlob(blobKey(datasetId));
    if (!data) throw new Error(`Dataset '${datasetId}' not found`);
    dataset = data as ReportDataset;
  } else {
    try {
      const raw = await readFile(localPath(datasetId), "utf-8");
      dataset = JSON.parse(raw) as ReportDataset;
    } catch {
      throw new Error(`Dataset '${datasetId}' not found. Vui lòng upload lại.`);
    }
  }

  dataset = await maybeRefreshSales(dataset);
  dataset = await maybeRefreshTarget(dataset);
  dataset.target = normalizeTarget(dataset.target, dataset.meta.targetFilename);
  return dataset;
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
    target = normalizeTarget(parseTargetBuffer(opts.targetBuffer, opts.targetFilename), opts.targetFilename);
    targetFilename = opts.targetFilename;
    await savePersistedTargetWithBuffer(target, targetFilename, opts.targetBuffer);
  } else {
    const saved = await loadPersistedTarget();
    if (!saved) {
      throw new Error("Chưa có file chỉ tiêu. Vui lòng upload file target.");
    }
    target = normalizeTarget(saved.target, saved.filename);
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
    salesSchemaVersion: SALES_SCHEMA_VERSION,
  };

  const dataset: ReportDataset = {
    meta,
    sales: salesParsed.rows,
    target,
    groupConfig: config,
  };

  await writeSalesBlob(datasetId, opts.salesBuffer);
  await saveReportDataset(dataset);
  return dataset;
}

export async function replacePersistedTarget(
  targetBuffer: Buffer,
  targetFilename: string,
  datasetId?: string | null,
): Promise<{ persisted: PersistedTarget; dataset: ReportDataset | null }> {
  const target = normalizeTarget(parseTargetBuffer(targetBuffer, targetFilename), targetFilename);
  const persisted = await savePersistedTargetWithBuffer(target, targetFilename, targetBuffer);

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
  dataset.target = normalizeTarget(dataset.target, dataset.meta.targetFilename);
  dataset.groupConfig = groupConfig;
  await saveReportDataset(dataset);
  return dataset;
}
