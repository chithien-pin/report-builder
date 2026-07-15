import { NextRequest, NextResponse } from "next/server";

import {
  loadPersistedTarget,
  replacePersistedTarget,
} from "@/lib/report/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const saved = await loadPersistedTarget();
    if (!saved) {
      return NextResponse.json({ savedTarget: null });
    }
    return NextResponse.json({
      savedTarget: {
        filename: saved.filename,
        updatedAt: saved.updatedAt,
        columns: saved.target.columns,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Load failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const targetFile = form.get("target");
    const datasetIdRaw = form.get("datasetId");
    const datasetId =
      typeof datasetIdRaw === "string" && datasetIdRaw.trim() ? datasetIdRaw.trim() : null;

    if (!(targetFile instanceof File)) {
      return NextResponse.json({ error: "Thiếu file chỉ tiêu (target)" }, { status: 400 });
    }

    const result = await replacePersistedTarget(
      Buffer.from(await targetFile.arrayBuffer()),
      targetFile.name,
      datasetId,
    );

    return NextResponse.json({
      savedTarget: {
        filename: result.persisted.filename,
        updatedAt: result.persisted.updatedAt,
        columns: result.persisted.target.columns,
      },
      datasetId: result.dataset?.meta.datasetId ?? null,
      meta: result.dataset?.meta ?? null,
      groupConfig: result.dataset?.groupConfig ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload target failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
