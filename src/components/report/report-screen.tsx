"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CalendarRange,
  RefreshCw,
  Settings2,
  Upload,
  Wallet,
} from "lucide-react";

import { AllDaysTable } from "@/components/report/all-days-table";
import { CategoryBreakdownCard } from "@/components/report/category-breakdown-card";
import { CommissionConfigDialog } from "@/components/report/commission-config-dialog";
import { CommissionForecastCard } from "@/components/report/commission-forecast-card";
import { DayDetailTable } from "@/components/report/day-detail-table";
import { EmployeePerformanceCard } from "@/components/report/employee-performance-card";
import { GroupConfigDialog } from "@/components/report/group-config-dialog";
import { MonthKpiProgress } from "@/components/report/month-kpi-progress";
import { OverviewDateRangeDialog } from "@/components/report/overview-date-range-dialog";
import { ReportCardNav } from "@/components/report/report-card-nav";
import { Button } from "@/components/ui/button";
import { fetchDailySeries, fetchDayReport, saveGroupConfig } from "@/lib/report-api";
import { useReportStore } from "@/lib/report-store";
import { buildCommissionForecast } from "@/lib/report/commission";
import type { CategoryBreakdown, GroupConfig } from "@/lib/report/types";
import { cn, formatNumber } from "@/lib/utils";

function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatOverviewScope(
  dates: string[],
  fromDate?: string | null,
  toDate?: string | null,
): string {
  if (fromDate || toDate) {
    const from = fromDate ? formatDateVi(fromDate) : "…";
    const to = toDate ? formatDateVi(toDate) : "…";
    return `${from} – ${to}`;
  }
  if (dates.length === 0) return "Lũy kế";
  if (dates.length === 1) return formatDateVi(dates[0]!);
  return `Lũy kế ${dates.length} ngày (${formatDateVi(dates[0]!)} – ${formatDateVi(dates[dates.length - 1]!)})`;
}

function CategoryStaleWarning() {
  return (
    <p className="mb-3 rounded-2xl bg-lavender-soft px-4 py-3 text-sm text-accent-foreground">
      Chỉ thấy danh mục &quot;Khác&quot; — vui lòng bấm <strong>Upload doanh số</strong> và tải lại file
      XLSX để cập nhật cơ cấu ngành hàng.
    </p>
  );
}

function isStaleCategoryBreakdown(data: CategoryBreakdown): boolean {
  return data.categories.length === 1 && data.categories[0]?.category === "Khác";
}

function KpiCard({
  label,
  actual,
  target,
  pct,
  tone,
}: {
  label: string;
  actual: number;
  target: number;
  pct: number | null;
  tone: "primary" | "coral";
}) {
  const good = pct != null && pct >= 1;
  const Arrow = good ? ArrowUpRight : ArrowDownRight;
  const toneCls =
    tone === "primary"
      ? "bg-lavender-soft text-primary"
      : "bg-coral-soft text-coral";

  return (
    <div className="soft-card px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", toneCls)}>
          <Arrow className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{formatNumber(actual)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        CT {formatNumber(target)}
        {pct != null && (
          <span className={cn("ml-2 font-medium", good ? "text-success" : "text-coral")}>
            {Math.round(pct * 1000) / 10}%
          </span>
        )}
      </p>
    </div>
  );
}

export function ReportScreen() {
  const datasetId = useReportStore((s) => s.datasetId);
  const meta = useReportStore((s) => s.meta);
  const groupConfig = useReportStore((s) => s.groupConfig);
  const selectedDate = useReportStore((s) => s.selectedDate);
  const viewMode = useReportStore((s) => s.viewMode);
  const dayReport = useReportStore((s) => s.dayReport);
  const categoryBreakdown = useReportStore((s) => s.categoryBreakdown);
  const employeePerformance = useReportStore((s) => s.employeePerformance);
  const series = useReportStore((s) => s.series);
  const monthKpi = useReportStore((s) => s.monthKpi);
  const loading = useReportStore((s) => s.loading);
  const error = useReportStore((s) => s.error);
  const commissionConfig = useReportStore((s) => s.commissionConfig);
  const overviewFromDate = useReportStore((s) => s.overviewFromDate);
  const overviewToDate = useReportStore((s) => s.overviewToDate);

  const setSelectedDate = useReportStore((s) => s.setSelectedDate);
  const setViewMode = useReportStore((s) => s.setViewMode);
  const setDayReport = useReportStore((s) => s.setDayReport);
  const setCategoryBreakdown = useReportStore((s) => s.setCategoryBreakdown);
  const setEmployeePerformance = useReportStore((s) => s.setEmployeePerformance);
  const setSeries = useReportStore((s) => s.setSeries);
  const setMonthKpi = useReportStore((s) => s.setMonthKpi);
  const setGroupConfig = useReportStore((s) => s.setGroupConfig);
  const setCommissionConfig = useReportStore((s) => s.setCommissionConfig);
  const setOverviewDateRange = useReportStore((s) => s.setOverviewDateRange);
  const setLoading = useReportStore((s) => s.setLoading);
  const setError = useReportStore((s) => s.setError);
  const clearSales = useReportStore((s) => s.clearSales);

  const [configOpen, setConfigOpen] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const isOverview = viewMode === "overview";
  const hasDateFilter = Boolean(overviewFromDate || overviewToDate);
  const overviewScopeLabel = formatOverviewScope(
    meta?.dates ?? [],
    overviewFromDate,
    overviewToDate,
  );

  const commissionForecast = useMemo(() => {
    if (!employeePerformance) return null;
    return buildCommissionForecast(
      employeePerformance.targetDetails,
      monthKpi,
      commissionConfig,
    );
  }, [commissionConfig, employeePerformance, monthKpi]);

  const overviewNavItems = useMemo(() => {
    const items: { id: string; label: string }[] = [];
    if (monthKpi) items.push({ id: "report-card-month-kpi", label: "Tiến độ tháng" });
    if (categoryBreakdown) items.push({ id: "report-card-category", label: "Cơ cấu ngành hàng" });
    if (employeePerformance && employeePerformance.employees.length > 0) {
      items.push({ id: "report-card-employees", label: "Hiệu suất nhân viên" });
    }
    if (commissionForecast) items.push({ id: "report-card-commission", label: "Hoa hồng dự kiến" });
    if (series.length > 0) items.push({ id: "report-card-all-days", label: "Tất cả ngày" });
    return items;
  }, [categoryBreakdown, commissionForecast, employeePerformance, monthKpi, series.length]);

  const loadDay = useCallback(
    async (date?: string | null) => {
      if (!datasetId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchDayReport(datasetId, date);
        setDayReport(res.report);
        setCategoryBreakdown(res.categoryBreakdown);
        setEmployeePerformance(res.employeePerformance);
        setGroupConfig(res.groupConfig);
        if (!date) setSelectedDate(res.report.date);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được báo cáo");
      } finally {
        setLoading(false);
      }
    },
    [
      datasetId,
      setCategoryBreakdown,
      setDayReport,
      setEmployeePerformance,
      setError,
      setGroupConfig,
      setLoading,
      setSelectedDate,
    ],
  );

  const loadSeries = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDailySeries(datasetId, {
        fromDate: overviewFromDate,
        toDate: overviewToDate,
      });
      setSeries(res.series);
      setMonthKpi(res.monthKpi);
      setCategoryBreakdown(res.categoryBreakdown);
      setEmployeePerformance(res.employeePerformance);
      setGroupConfig(res.groupConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chuỗi ngày");
    } finally {
      setLoading(false);
    }
  }, [
    datasetId,
    overviewFromDate,
    overviewToDate,
    setCategoryBreakdown,
    setEmployeePerformance,
    setError,
    setGroupConfig,
    setLoading,
    setMonthKpi,
    setSeries,
  ]);

  useEffect(() => {
    if (!datasetId) return;
    if (isOverview) {
      void loadSeries();
    } else {
      void loadDay(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when mode/dataset/date/range changes
  }, [datasetId, viewMode, selectedDate, overviewFromDate, overviewToDate]);

  function openDayDetail(date: string) {
    setSelectedDate(date);
    setViewMode("day");
  }

  function backToOverview() {
    setViewMode("overview");
  }

  async function handleSaveConfig(config: GroupConfig) {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await saveGroupConfig(datasetId, config, isOverview ? null : selectedDate);
      setGroupConfig(res.groupConfig);
      if (res.report) setDayReport(res.report);
      if (isOverview) {
        await loadSeries();
      } else if (selectedDate) {
        const dayRes = await fetchDayReport(datasetId, selectedDate);
        setDayReport(dayRes.report);
        setCategoryBreakdown(dayRes.categoryBreakdown);
        setEmployeePerformance(dayRes.employeePerformance);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu cấu hình thất bại");
    } finally {
      setLoading(false);
    }
  }

  if (!meta || !groupConfig || !datasetId) return null;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="shrink-0 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <div className="mr-auto min-w-0">
            {isOverview ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Báo cáo ngày</p>
                <h1 className="truncate text-xl font-bold md:text-2xl">Tổng quan</h1>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 mb-1 h-8 gap-1.5 px-2 text-muted-foreground"
                  onClick={backToOverview}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại tổng quan
                </Button>
                <h1 className="truncate text-xl font-bold md:text-2xl">
                  {meta.storeCode ? `${meta.storeCode} · ` : ""}
                  {selectedDate ? formatDateVi(selectedDate) : "—"}
                </h1>
              </>
            )}
            <p className="truncate text-xs text-muted-foreground">
              {meta.salesFilename} · {meta.rowCount} dòng · {meta.dates.length} ngày
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isOverview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(hasDateFilter && "border-primary/40 bg-lavender-soft text-primary")}
                onClick={() => setDateRangeOpen(true)}
              >
                <CalendarRange className="h-4 w-4" />
                {hasDateFilter ? overviewScopeLabel : "Từ – đến ngày"}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <Settings2 className="h-4 w-4" />
              Nhóm
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCommissionOpen(true)}>
              <Wallet className="h-4 w-4" />
              Hoa hồng
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (isOverview ? loadSeries() : loadDay(selectedDate))}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearSales}>
              <Upload className="h-4 w-4" />
              Upload doanh số
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 overflow-auto px-4 pb-6 md:px-6 lg:pr-52">
        {error && (
          <p className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
            {error.includes("not found") && (
              <button type="button" className="ml-2 font-medium underline" onClick={clearSales}>
                Upload doanh số lại
              </button>
            )}
          </p>
        )}

        {isOverview && (
          <>
            <ReportCardNav items={overviewNavItems} />
            {monthKpi && (
              <div id="report-card-month-kpi" className="scroll-mt-4">
                <MonthKpiProgress kpi={monthKpi} />
              </div>
            )}
            {categoryBreakdown && (
              <div id="report-card-category" className="scroll-mt-4">
                {isStaleCategoryBreakdown(categoryBreakdown) && <CategoryStaleWarning />}
                <CategoryBreakdownCard
                  data={categoryBreakdown}
                  scopeLabel={overviewScopeLabel}
                />
              </div>
            )}
            {employeePerformance && employeePerformance.employees.length > 0 && (
              <div id="report-card-employees" className="scroll-mt-4">
                <EmployeePerformanceCard
                  data={employeePerformance}
                  scopeLabel={overviewScopeLabel}
                />
              </div>
            )}
            {commissionForecast && (
              <div id="report-card-commission" className="scroll-mt-4">
                <CommissionForecastCard
                  data={commissionForecast}
                  onOpenConfig={() => setCommissionOpen(true)}
                />
              </div>
            )}
            <div id="report-card-all-days" className="scroll-mt-4">
              <AllDaysTable
                series={series}
                selectedDate={selectedDate}
                onSelectDate={openDayDetail}
              />
            </div>
          </>
        )}

        {!isOverview && dayReport && (
          <>
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <KpiCard
                label="Doanh thu ngày"
                actual={dayReport.total.dt.actual}
                target={dayReport.total.dt.target}
                pct={dayReport.total.dt.pct}
                tone="primary"
              />
              <KpiCard
                label="Sản lượng ngày"
                actual={dayReport.total.sl.actual}
                target={dayReport.total.sl.target}
                pct={dayReport.total.sl.pct}
                tone="coral"
              />
            </div>
            {categoryBreakdown && (
              <>
                {isStaleCategoryBreakdown(categoryBreakdown) && <CategoryStaleWarning />}
                <CategoryBreakdownCard
                  data={categoryBreakdown}
                  scopeLabel={selectedDate ? formatDateVi(selectedDate) : undefined}
                />
              </>
            )}
            {employeePerformance && employeePerformance.employees.length > 0 && (
              <EmployeePerformanceCard
                data={employeePerformance}
                scopeLabel={selectedDate ? formatDateVi(selectedDate) : undefined}
              />
            )}
            <DayDetailTable report={dayReport} />
          </>
        )}

        {loading &&
          ((isOverview && series.length === 0 && !categoryBreakdown) ||
            (!isOverview && !dayReport)) && (
          <p className="py-16 text-center text-muted-foreground">Đang tải…</p>
        )}
      </main>

      <GroupConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        productLines={meta.productLines}
        targetColumns={meta.targetColumns}
        value={groupConfig}
        onSave={handleSaveConfig}
      />
      <CommissionConfigDialog
        open={commissionOpen}
        onOpenChange={setCommissionOpen}
        employeeNames={employeePerformance?.employees.map((e) => e.name) ?? []}
        value={commissionConfig}
        onSave={setCommissionConfig}
      />
      <OverviewDateRangeDialog
        open={dateRangeOpen}
        onOpenChange={setDateRangeOpen}
        availableDates={meta.dates}
        fromDate={overviewFromDate}
        toDate={overviewToDate}
        onApply={setOverviewDateRange}
      />
    </div>
  );
}
