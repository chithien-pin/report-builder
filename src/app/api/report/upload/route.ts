import { NextRequest, NextResponse } from "next/server";

import {
  createReportDataset,
  loadPersistedTarget,
} from "@/lib/report/storage";
import type { GroupConfig } from "@/lib/report/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const salesFile = form.get("sales");
    const targetFile = form.get("target");
    const configRaw = form.get("groupConfig");

    if (!(salesFile instanceof File)) {
      return NextResponse.json({ error: "Thiếu file doanh số (sales)" }, { status: 400 });
    }

    let groupConfig: GroupConfig | null = null;
    if (typeof configRaw === "string" && configRaw.trim()) {
      groupConfig = JSON.parse(configRaw) as GroupConfig;
    }

    const salesBuffer = Buffer.from(await salesFile.arrayBuffer());
    const hasNewTarget = targetFile instanceof File;

    if (!hasNewTarget) {
      const saved = await loadPersistedTarget();
      if (!saved) {
        return NextResponse.json(
          { error: "Chưa có file chỉ tiêu đã lưu. Vui lòng upload target." },
          { status: 400 },
        );
      }
    }

    const dataset = await createReportDataset({
      salesBuffer,
      salesFilename: salesFile.name,
      targetBuffer: hasNewTarget ? Buffer.from(await targetFile.arrayBuffer()) : null,
      targetFilename: hasNewTarget ? targetFile.name : null,
      groupConfig,
    });

    const savedTarget = await loadPersistedTarget();

    return NextResponse.json({
      datasetId: dataset.meta.datasetId,
      meta: dataset.meta,
      groupConfig: dataset.groupConfig,
      savedTarget: savedTarget
        ? {
            filename: savedTarget.filename,
            updatedAt: savedTarget.updatedAt,
            columns: savedTarget.target.columns,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
