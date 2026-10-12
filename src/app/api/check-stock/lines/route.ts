import { readLines, saveLines } from "@/lib/check-stock/server/store";
import type { CountLine } from "@/lib/check-stock/types";
import { fail, json } from "@/lib/check-stock/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return json(await readLines());
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { lines?: CountLine[]; qtyTolerance?: number; baseRev?: number };
    if (!Array.isArray(body.lines) || typeof body.baseRev !== "number") {
      return json({ error: "Thiếu dòng hoặc baseRev." }, 400);
    }
    const qtyTolerance = typeof body.qtyTolerance === "number" && body.qtyTolerance >= 0 ? body.qtyTolerance : 0;
    const saved = await saveLines(body.lines, qtyTolerance, body.baseRev);
    if ("error" in saved && saved.error) return json({ error: saved.error }, 400);
    if ("conflict" in saved) return json({ error: "conflict", current: saved.conflict }, 409);
    return json(saved.file);
  } catch (error) {
    return fail(error);
  }
}
