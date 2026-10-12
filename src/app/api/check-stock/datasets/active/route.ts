import { setActiveDataset } from "@/lib/check-stock/server/store";
import { fail, json } from "@/lib/check-stock/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; baseRev?: number };
    if (!body.id || !/^[\w-]+$/.test(body.id) || typeof body.baseRev !== "number") {
      return json({ error: "Thiếu dataset hoặc baseRev." }, 400);
    }
    const saved = await setActiveDataset(body.id, body.baseRev);
    if ("error" in saved && saved.error) return json({ error: saved.error }, 400);
    if ("conflict" in saved) return json({ error: "conflict", current: saved.conflict }, 409);
    return json(saved.file);
  } catch (error) {
    return fail(error);
  }
}
