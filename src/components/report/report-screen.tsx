"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  LayoutList,
  RefreshCw,
  Settings2,
  Upload,
} from "lucide-react";

import { AllDaysTable } from "@/components/report/all-days-table";
import { DayDetailTable } from "@/components/report/day-detail-table";
import { GroupConfigDialog } from "@/components/report/group-config-dialog";
import { Button } from "@/components/ui/button";
import { fetchDailySeries, fetchDayReport, saveGroupConfig } from "@/lib/report-api";
import { useReportStore } from "@/lib/report-store";
import type { GroupConfig } from "@/lib/report/types";
import { cn, formatNumber } from "@/lib/utils";

function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
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
  const series = useReportStore((s) => s.series);
  const loading = useReportStore((s) => s.loading);
  const error = useReportStore((s) => s.error);

  const setSelectedDate = useReportStore((s) => s.setSelectedDate);
  const setViewMode = useReportStore((s) => s.setViewMode);
  const setDayReport = useReportStore((s) => s.setDayReport);
  const setSeries = useReportStore((s) => s.setSeries);
  const setGroupConfig = useReportStore((s) => s.setGroupConfig);
  const setLoading = useReportStore((s) => s.setLoading);
  const setError = useReportStore((s) => s.setError);
  const clearSales = useReportStore((s) => s.clearSales);

  const [configOpen, setConfigOpen] = useState(false);

  const loadDay = useCallback(
    async (date?: string | null) => {
      if (!datasetId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchDayReport(datasetId, date);
        setDayReport(res.report);
        setGroupConfig(res.groupConfig);
        if (!date) setSelectedDate(res.report.date);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được báo cáo");
      } finally {
        setLoading(false);
      }
    },
    [datasetId, setDayReport, setError, setGroupConfig, setLoading, setSelectedDate],
  );

  const loadSeries = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDailySeries(datasetId);
      setSeries(res.series);
      setGroupConfig(res.groupConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chuỗi ngày");
    } finally {
      setLoading(false);
    }
  }, [datasetId, setError, setGroupConfig, setLoading, setSeries]);

  useEffect(() => {
    if (!datasetId) return;
    if (viewMode === "day") {
      void loadDay(selectedDate);
    } else {
      void loadSeries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when mode/dataset/date changes
  }, [datasetId, viewMode, selectedDate]);

  async function handleSaveConfig(config: GroupConfig) {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await saveGroupConfig(datasetId, config, selectedDate);
      setGroupConfig(res.groupConfig);
      if (res.report) setDayReport(res.report);
      if (viewMode === "all") await loadSeries();
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
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Báo cáo ngày</p>
            <h1 className="truncate text-xl font-bold md:text-2xl">
              {meta.storeCode ? `${meta.storeCode} · ` : ""}
              {selectedDate ? formatDateVi(selectedDate) : "—"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {meta.salesFilename} · {meta.rowCount} dòng · {meta.dates.length} ngày
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-full border-0 bg-card px-4 text-sm shadow-[var(--shadow-soft)] outline-none ring-0 focus:ring-2 focus:ring-primary/30"
              value={selectedDate ?? ""}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setViewMode("day");
              }}
            >
              {meta.dates.map((d) => (
                <option key={d} value={d}>
                  {formatDateVi(d)}
                </option>
              ))}
            </select>

            <div className="flex rounded-full bg-card p-1 shadow-[var(--shadow-soft)]">
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  viewMode === "day"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setViewMode("day")}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Chi tiết ngày
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  viewMode === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setViewMode("all")}
              >
                <LayoutList className="h-3.5 w-3.5" />
                Tất cả ngày
              </button>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <Settings2 className="h-4 w-4" />
              Nhóm
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (viewMode === "day" ? loadDay(selectedDate) : loadSeries())}
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

      <main className="mx-auto w-full max-w-7xl flex-1 overflow-auto px-4 pb-6 md:px-6">
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

        {dayReport && viewMode === "day" && (
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
        )}

        {viewMode === "day" && dayReport && <DayDetailTable report={dayReport} />}
        {viewMode === "all" && (
          <AllDaysTable
            series={series}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setViewMode("day");
            }}
          />
        )}

        {loading && !dayReport && series.length === 0 && (
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
    </div>
  );
}
