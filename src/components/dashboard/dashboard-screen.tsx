"use client";

import { SlidersHorizontal, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FilterDialog } from "@/components/filter/filter-dialog";
import { FilterSummary } from "@/components/filter/filter-summary";
import { SummaryCard } from "@/components/summary-card/summary-card";
import { TabBar } from "@/components/tab-view/tab-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchSummary } from "@/lib/api-client";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { hasValidFilterSelection, useDashboardStore } from "@/lib/store";

export function DashboardScreen() {
  const datasetId = useDashboardStore((s) => s.datasetId);
  const meta = useDashboardStore((s) => s.meta);
  const primaryGroupColumn = useDashboardStore((s) => s.primaryGroupColumn);
  const secondaryGroupColumns = useDashboardStore((s) => s.secondaryGroupColumns);
  const selectedValuesByColumn = useDashboardStore((s) => s.selectedValuesByColumn);
  const sumColumns = useDashboardStore((s) => s.sumColumns);
  const dateGranularity = useDashboardStore((s) => s.dateGranularity);
  const activeTabKey = useDashboardStore((s) => s.activeTabKey);
  const summaryTabs = useDashboardStore((s) => s.summaryTabs);
  const summaryLoading = useDashboardStore((s) => s.summaryLoading);
  const summaryError = useDashboardStore((s) => s.summaryError);
  const pendingFilterSetup = useDashboardStore((s) => s.pendingFilterSetup);
  const setSummaryTabs = useDashboardStore((s) => s.setSummaryTabs);
  const setSummaryLoading = useDashboardStore((s) => s.setSummaryLoading);
  const setSummaryError = useDashboardStore((s) => s.setSummaryError);
  const saveConfigForSchema = useDashboardStore((s) => s.saveConfigForSchema);
  const clearPendingFilterSetup = useDashboardStore((s) => s.clearPendingFilterSetup);
  const reset = useDashboardStore((s) => s.reset);

  const [filterOpen, setFilterOpen] = useState(false);
  const setupPrompted = useRef(false);

  const configKey = useMemo(
    () =>
      JSON.stringify({
        datasetId,
        primaryGroupColumn,
        secondaryGroupColumns,
        selectedValuesByColumn,
        sumColumns,
        dateGranularity,
      }),
    [
      datasetId,
      primaryGroupColumn,
      secondaryGroupColumns,
      selectedValuesByColumn,
      sumColumns,
      dateGranularity,
    ],
  );
  const debouncedConfig = useDebounce(configKey, 450);

  const loadSummary = useCallback(async () => {
    if (
      !datasetId ||
      !primaryGroupColumn ||
      !hasValidFilterSelection(primaryGroupColumn, secondaryGroupColumns, selectedValuesByColumn) ||
      sumColumns.length === 0
    ) {
      setSummaryTabs([]);
      return;
    }
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const result = await fetchSummary({
        datasetId,
        primaryGroupColumn,
        secondaryGroupColumns,
        selectedValuesByColumn,
        sumColumns,
        dateGranularity,
      });
      setSummaryTabs(result.tabs);
      saveConfigForSchema();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Không tải được tổng hợp");
    } finally {
      setSummaryLoading(false);
    }
  }, [
    datasetId,
    primaryGroupColumn,
    secondaryGroupColumns,
    selectedValuesByColumn,
    sumColumns,
    dateGranularity,
    setSummaryTabs,
    setSummaryError,
    setSummaryLoading,
    saveConfigForSchema,
  ]);

  useEffect(() => {
    void loadSummary();
  }, [debouncedConfig, loadSummary]);

  useEffect(() => {
    if (pendingFilterSetup) {
      setFilterOpen(true);
      clearPendingFilterSetup();
      setupPrompted.current = true;
    }
  }, [pendingFilterSetup, clearPendingFilterSetup]);

  useEffect(() => {
    if (
      setupPrompted.current ||
      !meta ||
      hasValidFilterSelection(primaryGroupColumn, secondaryGroupColumns, selectedValuesByColumn)
    ) {
      return;
    }
    setFilterOpen(true);
    setupPrompted.current = true;
  }, [meta, primaryGroupColumn, secondaryGroupColumns, selectedValuesByColumn]);

  const activeTab = summaryTabs.find((t) => t.key === activeTabKey) ?? summaryTabs[0];
  const activeSegment = activeTab?.segments[0];

  if (!meta || !datasetId) return null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold sm:text-base">{meta.filename}</p>
            {summaryLoading && <Badge variant="secondary">Đang tính...</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {meta.row_count.toLocaleString("vi-VN")} dòng · {summaryTabs.length} tab
          </p>
          <div className="mt-2 hidden sm:block">
            <FilterSummary />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="default" size="sm" onClick={() => setFilterOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Cấu hình</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => reset()}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload mới</span>
          </Button>
        </div>
      </header>

      <div className="shrink-0 border-b border-border bg-card/50 px-4 py-2 sm:px-6">
        <TabBar compact />
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        {summaryError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {summaryError}
          </div>
        )}

        {activeTab && activeSegment ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">{activeTab.label}</h2>
              <span className="text-sm text-muted-foreground">
                {activeTab.row_count.toLocaleString("vi-VN")} dòng
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {sumColumns.map((col) => (
                <SummaryCard
                  key={col}
                  title={meta.columns.find((c) => c.name === col)?.original_name ?? col}
                  value={activeSegment.values[col] ?? null}
                  rowCount={activeSegment.row_count}
                  datasetId={datasetId}
                  columns={meta.columns}
                  primaryGroupColumn={primaryGroupColumn!}
                  secondaryGroupColumns={secondaryGroupColumns}
                  selectedValuesByColumn={selectedValuesByColumn}
                  primaryValue={activeTab.key}
                  dateGranularity={dateGranularity}
                />
              ))}
            </div>
          </section>
        ) : (
          !summaryLoading && (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-md text-muted-foreground">
                Mở cấu hình để chọn nhóm chính (tab), nhóm phụ (card) và cột số cần xem.
              </p>
              <Button onClick={() => setFilterOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" />
                Mở cấu hình
              </Button>
            </div>
          )
        )}
      </main>

      <FilterDialog open={filterOpen} onOpenChange={setFilterOpen} />

      <footer className="shrink-0 border-t border-border px-4 py-1.5 text-center text-[11px] text-muted-foreground sm:px-6">
        File mẫu:{" "}
        <Link href="/sample-data/sales_sample_10k.csv" className="underline hover:text-foreground">
          sales_sample_10k.csv
        </Link>
      </footer>
    </div>
  );
}
