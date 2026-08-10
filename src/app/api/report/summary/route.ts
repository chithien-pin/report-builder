import { NextRequest, NextResponse } from "next/server";

import { buildDailySeries, buildDayReport, buildMonthKpi } from "@/lib/report/engine";
import { buildCategoryBreakdown } from "@/lib/report/category-breakdown";
import { buildEmployeePerformance } from "@/lib/report/employee-performance";
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
      const monthKpi = buildMonthKpi(dataset.sales, dataset.target, dataset.groupConfig);
      const lastDate = dataset.meta.dates[dataset.meta.dates.length - 1];
      const asOfDate =
        [...dataset.sales.map((r) => r.date)]
          .filter((d) => d.startsWith(dataset.target.planMonth))
          .sort()
          .pop() ??
        lastDate ??
        dataset.target.planMonth + "-01";

      const categoryBreakdown = buildCategoryBreakdown(dataset.sales, dataset.target, {
        asOfDate,
      });
      const employeePerformance = buildEmployeePerformance(dataset.sales, {
        asOfDate,
        target: dataset.target,
      });
      return NextResponse.json({
        meta: dataset.meta,
        groupConfig: dataset.groupConfig,
        series,
        monthKpi,
        categoryBreakdown,
        employeePerformance,
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
    const categoryBreakdown = buildCategoryBreakdown(dataset.sales, dataset.target, {
      periodDate: selected,
      asOfDate: selected,
    });
    const employeePerformance = buildEmployeePerformance(dataset.sales, {
      periodDate: selected,
      asOfDate: selected,
      target: dataset.target,
    });

    return NextResponse.json({
      meta: dataset.meta,
      groupConfig: dataset.groupConfig,
      report,
      categoryBreakdown,
      employeePerformance,
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
