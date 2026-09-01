import { NextRequest, NextResponse } from "next/server";

import { buildDailySeries, buildDayReport, buildMonthKpi } from "@/lib/report/engine";
import { buildCategoryBreakdown } from "@/lib/report/category-breakdown";
import { buildEmployeePerformance } from "@/lib/report/employee-performance";
import { clampDateRange, filterSalesByDateRange } from "@/lib/report/date-range";
import { buildProductCatalog, buildSkuSalesLines } from "@/lib/report/custom-product-groups";
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
    const fromDateParam = searchParams.get("fromDate");
    const toDateParam = searchParams.get("toDate");

    if (!datasetId) {
      return NextResponse.json({ error: "Thiếu datasetId" }, { status: 400 });
    }

    const dataset = await loadReportDataset(datasetId);

    if (mode === "series") {
      const { fromDate, toDate } = clampDateRange(
        fromDateParam,
        toDateParam,
        dataset.meta.dates,
      );
      const asOfDate =
        toDate ??
        [...dataset.sales.map((r) => r.date)]
          .filter((d) => d.startsWith(dataset.target.planMonth))
          .sort()
          .pop() ??
        dataset.meta.dates[dataset.meta.dates.length - 1] ??
        dataset.target.planMonth + "-01";

      const kpiSales = filterSalesByDateRange(dataset.sales, null, asOfDate);
      const monthKpi = buildMonthKpi(kpiSales, dataset.target, dataset.groupConfig);

      const fullSeries = buildDailySeries(dataset.sales, dataset.target, dataset.groupConfig);
      const series = fullSeries.filter((row) => {
        if (fromDate && row.date < fromDate) return false;
        if (toDate && row.date > toDate) return false;
        return true;
      });

      const hasRange = Boolean(fromDate || toDate);
      const periodFrom = hasRange ? fromDate ?? dataset.meta.dates[0] : null;
      const periodTo = hasRange ? toDate ?? asOfDate : null;
      const categoryBreakdown = buildCategoryBreakdown(dataset.sales, dataset.target, {
        periodFrom,
        periodTo,
        asOfDate,
      });
      const employeePerformance = buildEmployeePerformance(dataset.sales, {
        periodFrom,
        periodTo,
        asOfDate,
        target: dataset.target,
      });
      const productCatalog = buildProductCatalog(dataset.sales);
      const skuLines = buildSkuSalesLines(
        dataset.sales,
        periodFrom ?? dataset.meta.dates[0],
        periodTo ?? asOfDate,
      );
      return NextResponse.json({
        meta: dataset.meta,
        groupConfig: dataset.groupConfig,
        series,
        monthKpi,
        categoryBreakdown,
        employeePerformance,
        dateRange: { fromDate, toDate },
        productCatalog,
        skuLines,
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
