import { readIndex, registerDataset } from "@/lib/check-stock/server/store";
import type { DatasetMeta } from "@/lib/check-stock/types";
import { fail, json } from "@/lib/check-stock/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validMeta(meta: DatasetMeta | undefined): meta is DatasetMeta {
  if (!meta) return false;
  return /^[\w-]+$/.test(meta.id) && Boolean(meta.fileName) && Boolean(meta.importedBy) && typeof meta.rowCount === "number";
}

export async function GET() {
  try {
    return json(await readIndex());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { baseRev?: number; meta?: DatasetMeta; activate?: boolean };
    if (typeof body.baseRev !== "number" || !validMeta(body.meta)) {
      return json({ error: "Thiếu thông tin dataset." }, 400);
    }
    const saved = await registerDataset(body.meta, body.baseRev, Boolean(body.activate));
    if ("error" in saved && saved.error) return json({ error: saved.error }, 400);
    if ("conflict" in saved) return json({ error: "conflict", current: saved.conflict }, 409);
    return json(saved.file);
  } catch (error) {
    return fail(error);
  }
}
