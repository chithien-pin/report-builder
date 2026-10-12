import { asCategory, deleteSession, readSession, saveSession } from "@/lib/check-stock/server/store";
import type { SessionDoc } from "@/lib/check-stock/types";
import { fail, json } from "@/lib/check-stock/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ category: string; key: string }> };

async function identity(context: Context) {
  const params = await context.params;
  const category = asCategory(params.category);
  const key = decodeURIComponent(params.key);
  if (!category || !/^\d{8}_[a-z0-9]+$/.test(key)) return null;
  return { category, key };
}

export async function GET(_request: Request, context: Context) {
  try {
    const parsed = await identity(context);
    if (!parsed) return json({ error: "Phiên không hợp lệ." }, 400);
    const doc = await readSession(parsed.category, parsed.key);
    if (!doc) return json({ error: "Không thấy phiên." }, 404);
    return json(doc);
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const parsed = await identity(context);
    if (!parsed) return json({ error: "Phiên không hợp lệ." }, 400);
    const body = (await request.json()) as { baseRev?: number; doc?: SessionDoc };
    if (!body.doc || typeof body.baseRev !== "number") return json({ error: "Thiếu doc hoặc baseRev." }, 400);
    const saved = await saveSession(parsed.category, parsed.key, body.doc, body.baseRev);
    if ("conflict" in saved) return json({ error: "conflict", current: saved.conflict }, 409);
    return json(saved.file);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const parsed = await identity(context);
    if (!parsed) return json({ error: "Phiên không hợp lệ." }, 400);
    await deleteSession(parsed.category, parsed.key);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
