import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobNotFoundError, del, head, list, put } from "@vercel/blob";

const ROOT = path.join(process.cwd(), "data");
export const BLOB_CACHE_MAX_AGE = 60;

export function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || undefined;
}

function assertPath(pathname: string): string {
  if (!pathname.startsWith("check-stock/") || pathname.includes("..")) {
    throw new Error("Đường dẫn lưu trữ không hợp lệ.");
  }
  return path.join(ROOT, pathname);
}

function withVersion(url: string, rev: number): string {
  const next = new URL(url);
  next.searchParams.set("v", String(rev));
  return next.toString();
}

async function readLocal<T>(pathname: string): Promise<T | null> {
  try {
    const raw = await readFile(assertPath(pathname), "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeLocal(pathname: string, data: unknown) {
  const file = assertPath(pathname);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data), "utf8");
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  const token = blobToken();
  if (!token) return readLocal<T>(pathname);
  try {
    const info = await head(pathname, { token });
    const generation = new Date(info.uploadedAt).getTime();
    const response = await fetch(withVersion(info.url, generation), { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

export async function writeJson(pathname: string, data: unknown) {
  const token = blobToken();
  if (!token) {
    await writeLocal(pathname, data);
    return;
  }
  await put(pathname, JSON.stringify(data), {
    access: "public",
    token,
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: BLOB_CACHE_MAX_AGE,
    contentType: "application/json",
  });
}

export async function removeJson(pathname: string) {
  const token = blobToken();
  if (!token) {
    await rm(assertPath(pathname), { force: true });
    return;
  }
  await del(pathname, { token });
}

export async function existsJson(pathname: string): Promise<boolean> {
  const token = blobToken();
  if (!token) {
    try {
      await stat(assertPath(pathname));
      return true;
    } catch {
      return false;
    }
  }
  try {
    await head(pathname, { token });
    return true;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return false;
    throw error;
  }
}

export async function blobDownloadUrl(pathname: string): Promise<string | null> {
  const token = blobToken();
  if (!token) return null;
  try {
    const info = await head(pathname, { token });
    return withVersion(info.url, new Date(info.uploadedAt).getTime());
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

export async function listSessionFiles(): Promise<{ pathname: string; updatedAt: string }[]> {
  const token = blobToken();
  if (!token) {
    const root = path.join(ROOT, "check-stock", "sessions");
    const found: { pathname: string; updatedAt: string }[] = [];
    let categories: string[] = [];
    try {
      categories = await readdir(root);
    } catch {
      return [];
    }
    for (const category of categories) {
      const dir = path.join(root, category);
      const info = await stat(dir).catch(() => null);
      if (!info?.isDirectory()) continue;
      const files = await readdir(dir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const full = path.join(dir, file);
        const fileInfo = await stat(full);
        found.push({
          pathname: `check-stock/sessions/${category}/${file}`,
          updatedAt: fileInfo.mtime.toISOString(),
        });
      }
    }
    return found;
  }

  const found: { pathname: string; updatedAt: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "check-stock/sessions/", token, limit: 1000, cursor });
    for (const blob of page.blobs) {
      if (blob.pathname.endsWith(".json")) {
        found.push({ pathname: blob.pathname, updatedAt: new Date(blob.uploadedAt).toISOString() });
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return found;
}
