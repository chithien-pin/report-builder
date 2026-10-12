import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { BLOB_CACHE_MAX_AGE, blobToken } from "@/lib/check-stock/server/blob";
import { fail, json } from "@/lib/check-stock/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return json({ mode: blobToken() ? "blob" : "local" });
}

export async function POST(request: Request) {
  if (!blobToken()) return json({ error: "local-storage" }, 501);
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!/^check-stock\/datasets\/[\w-]+\.json$/.test(pathname)) {
          throw new Error("Chỉ được upload dataset.");
        }
        return {
          allowedContentTypes: ["application/json"],
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: BLOB_CACHE_MAX_AGE,
          maximumSizeInBytes: 80 * 1024 * 1024,
        };
      },
    });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không cấp được token upload.";
    if (message === "local-storage") return fail(error);
    return json({ error: message }, 400);
  }
}
