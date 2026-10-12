import { blobToken } from "@/lib/check-stock/server/blob";
import { writeDataset } from "@/lib/check-stock/server/store";
import type { DatasetFile } from "@/lib/check-stock/types";
import { fail, json } from "@/lib/check-stock/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (blobToken()) return json({ error: "Dataset lớn phải upload bằng client blob." }, 400);
    const { id } = await context.params;
    if (!/^[\w-]+$/.test(id)) return json({ error: "Id không hợp lệ." }, 400);
    const body = (await request.json()) as DatasetFile;
    if (!body || body.id !== id || !Array.isArray(body.rows)) {
      return json({ error: "Nội dung dataset không hợp lệ." }, 400);
    }
    await writeDataset({ id, reportDate: body.reportDate ?? null, rows: body.rows });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
