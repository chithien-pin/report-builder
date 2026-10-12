import { datasetUrl, readDataset } from "@/lib/check-stock/server/store";
import { blobToken } from "@/lib/check-stock/server/blob";
import { fail, json } from "@/lib/check-stock/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[\w-]+$/.test(id)) return json({ error: "Id không hợp lệ." }, 400);
    if (!blobToken()) {
      const file = await readDataset(id);
      if (!file) return json({ error: "Không thấy dataset." }, 404);
      return json({ file });
    }
    const url = await datasetUrl(id);
    if (!url) return json({ error: "Không thấy dataset." }, 404);
    return json({ url });
  } catch (error) {
    return fail(error);
  }
}
