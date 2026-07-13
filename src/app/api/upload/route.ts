import { NextResponse } from "next/server";

import { ingestBytes } from "@/lib/server/file-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ detail: "Missing file" }, { status: 400 });
    }

    if (!file.name) {
      return NextResponse.json({ detail: "Missing filename" }, { status: 400 });
    }

    const content = Buffer.from(await file.arrayBuffer());
    if (content.length === 0) {
      return NextResponse.json({ detail: "File is empty" }, { status: 400 });
    }

    const { datasetId, meta, preview } = await ingestBytes(content, file.name);

    return NextResponse.json({
      dataset_id: datasetId,
      meta,
      preview,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file";
    const status = message.includes("BLOB_READ_WRITE_TOKEN")
      ? 503
      : message.includes("Unsupported")
        ? 400
        : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}
