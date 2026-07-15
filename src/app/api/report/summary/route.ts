import { NextRequest, NextResponse } from "next/server";

import { buildDailySeries, buildDayReport } from "@/lib/report/engine";
import { loadReportDataset, updateGroupConfig } from "@/lib/report/storage";
import type { GroupConfig } from "@/lib/report/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetId = searchParams.get("datasetId");
    const date = searchParams.get("date");
    const mode = searchParams.get("mode") ?? "day";

    if (!datasetId) {
      return NextResponse.json({ error: "Thiếu datasetId" }, { status: 400 });
    }

    const dataset = await loadReportDataset(datasetId);

    if (mode === "series") {
      const series = buildDailySeries(dataset.sales, dataset.target, dataset.groupConfig);
      return NextResponse.json({
        meta: dataset.meta,
        groupConfig: dataset.groupConfig,
        series,
      });
    }

    const selected =
      date && dataset.meta.dates.includes(date)
        ? date
        : dataset.meta.dates[dataset.meta.dates.length - 1];

    if (!selected) {
      return NextResponse.json({ error: "Không có ngày dữ liệu" }, { status: 400 });
    }

    const report = buildDayReport(
      dataset.sales,
      dataset.target,
      dataset.groupConfig,
      selected,
    );

    return NextResponse.json({
      meta: dataset.meta,
      groupConfig: dataset.groupConfig,
      report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Load failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      datasetId?: string;
      groupConfig?: GroupConfig;
      date?: string;
    };

    if (!body.datasetId || !body.groupConfig) {
      return NextResponse.json({ error: "Thiếu datasetId hoặc groupConfig" }, { status: 400 });
    }

    const dataset = await updateGroupConfig(body.datasetId, body.groupConfig);
    const selected =
      body.date && dataset.meta.dates.includes(body.date)
        ? body.date
        : dataset.meta.dates[dataset.meta.dates.length - 1];

    const report = selected
      ? buildDayReport(dataset.sales, dataset.target, dataset.groupConfig, selected)
      : null;

    return NextResponse.json({
      meta: dataset.meta,
      groupConfig: dataset.groupConfig,
      report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
