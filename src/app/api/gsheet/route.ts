import { NextResponse } from "next/server";

import { ingestCsvText } from "@/lib/server/file-parser";
import { fetchPublicSheetCsv } from "@/lib/server/google-sheets";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ detail: "URL is required" }, { status: 400 });
    }

    const csvText = await fetchPublicSheetCsv(url);
    const { datasetId, meta, preview } = await ingestCsvText(csvText, "google_sheet.csv");

    return NextResponse.json({
      dataset_id: datasetId,
      meta,
      preview,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import sheet";
    const status =
      message.includes("Không") || message.includes("Sheet") || message.includes("link")
        ? 400
        : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}
