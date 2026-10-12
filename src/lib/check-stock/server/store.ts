import { duplicatePrefixes } from "@/lib/check-stock/match";
import { seedLines } from "@/lib/check-stock/seed";
import { blobDownloadUrl, existsJson, listSessionFiles, readJson, removeJson, writeJson } from "@/lib/check-stock/server/blob";
import type {
  CategoryId,
  DatasetFile,
  DatasetMeta,
  DatasetsIndex,
  LinesFile,
  SessionDoc,
  SessionListItem,
} from "@/lib/check-stock/types";

export const LINES_PATH = "check-stock/lines.json";
export const DATASET_INDEX_PATH = "check-stock/datasets/index.json";

const CATEGORIES = new Set<CategoryId>(["loai1", "loai2", "loai3"]);

export function asCategory(value: string): CategoryId | null {
  return CATEGORIES.has(value as CategoryId) ? (value as CategoryId) : null;
}

export function datasetPath(id: string): string {
  return `check-stock/datasets/${id}.json`;
}

export function sessionPath(category: string, key: string): string {
  return `check-stock/sessions/${category}/${key}.json`;
}

export function emptyIndex(): DatasetsIndex {
  return { rev: 0, updatedAt: new Date(0).toISOString(), activeId: null, items: [] };
}

export async function readLines(): Promise<LinesFile> {
  const current = await readJson<LinesFile>(LINES_PATH);
  if (current?.lines) return current;
  const seeded: LinesFile = {
    rev: 1,
    updatedAt: new Date().toISOString(),
    qtyTolerance: 0,
    lines: seedLines(),
  };
  await writeJson(LINES_PATH, seeded);
  return seeded;
}

export async function saveLines(lines: LinesFile["lines"], qtyTolerance: number, baseRev: number) {
  const dupes = duplicatePrefixes(lines);
  if (dupes.length > 0) return { error: `Đầu mã bị trùng: ${dupes.slice(0, 6).join(", ")}` };
  const current = await readLines();
  if (current.rev !== baseRev) return { conflict: current };
  const next: LinesFile = {
    rev: current.rev + 1,
    updatedAt: new Date().toISOString(),
    qtyTolerance,
    lines,
  };
  await writeJson(LINES_PATH, next);
  return { file: next };
}

export async function readIndex(): Promise<DatasetsIndex> {
  return (await readJson<DatasetsIndex>(DATASET_INDEX_PATH)) ?? emptyIndex();
}

export async function registerDataset(meta: DatasetMeta, baseRev: number, activate: boolean) {
  if (!(await existsJson(datasetPath(meta.id)))) return { error: "Chưa thấy file dataset." };
  const current = await readIndex();
  if (current.rev !== baseRev) return { conflict: current };
  const items = [meta, ...current.items.filter((item) => item.id !== meta.id)];
  const next: DatasetsIndex = {
    rev: current.rev + 1,
    updatedAt: new Date().toISOString(),
    activeId: activate ? meta.id : current.activeId,
    items,
  };
  await writeJson(DATASET_INDEX_PATH, next);
  return { file: next };
}

export async function setActiveDataset(id: string, baseRev: number) {
  if (!(await existsJson(datasetPath(id)))) return { error: "Không thấy dataset." };
  const current = await readIndex();
  if (current.rev !== baseRev) return { conflict: current };
  if (!current.items.some((item) => item.id === id)) return { error: "Dataset chưa được ghi vào danh sách." };
  const next: DatasetsIndex = {
    ...current,
    rev: current.rev + 1,
    updatedAt: new Date().toISOString(),
    activeId: id,
  };
  await writeJson(DATASET_INDEX_PATH, next);
  return { file: next };
}

export async function readDataset(id: string): Promise<DatasetFile | null> {
  return readJson<DatasetFile>(datasetPath(id));
}

export async function writeDataset(file: DatasetFile) {
  await writeJson(datasetPath(file.id), file);
}

export async function datasetUrl(id: string): Promise<string | null> {
  if (!(await existsJson(datasetPath(id)))) return null;
  return blobDownloadUrl(datasetPath(id));
}

export async function listSessions(): Promise<SessionListItem[]> {
  const files = await listSessionFiles();
  const items: SessionListItem[] = [];
  for (const file of files) {
    const match = file.pathname.match(/^check-stock\/sessions\/([^/]+)\/([^/]+)\.json$/);
    if (!match) continue;
    const category = asCategory(match[1]);
    if (!category) continue;
    const doc = await readJson<SessionDoc>(file.pathname);
    if (!doc) continue;
    items.push({
      category,
      key: match[2],
      date: doc.date,
      time: doc.time,
      ca: doc.ca,
      inspector: doc.inspector,
      datasetId: doc.datasetId,
      updatedAt: doc.updatedAt || file.updatedAt,
      lastExportedAt: doc.lastExportedAt,
    });
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readSession(category: CategoryId, key: string): Promise<SessionDoc | null> {
  return readJson<SessionDoc>(sessionPath(category, key));
}

export async function saveSession(category: CategoryId, key: string, doc: SessionDoc, baseRev: number) {
  const current = await readSession(category, key);
  const currentRev = current?.rev ?? 0;
  if (currentRev !== baseRev) return { conflict: current ?? { ...doc, rev: currentRev } };
  const next: SessionDoc = {
    ...doc,
    category,
    id: key,
    rev: currentRev + 1,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(sessionPath(category, key), next);
  return { file: next };
}

export async function deleteSession(category: CategoryId, key: string) {
  await removeJson(sessionPath(category, key));
}
