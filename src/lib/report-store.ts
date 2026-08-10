"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  CategoryBreakdown,
  DailyCompactRow,
  DayReport,
  EmployeePerformance,
  GroupConfig,
  MonthKpiSummary,
  ReportDatasetMeta,
  SavedTargetMeta,
} from "@/lib/report/types";

export type ReportViewMode = "overview" | "day";

interface ReportState {
  datasetId: string | null;
  meta: ReportDatasetMeta | null;
  groupConfig: GroupConfig | null;
  savedTarget: SavedTargetMeta | null;
  selectedDate: string | null;
  viewMode: ReportViewMode;
  dayReport: DayReport | null;
  categoryBreakdown: CategoryBreakdown | null;
  employeePerformance: EmployeePerformance | null;
  series: DailyCompactRow[];
  monthKpi: MonthKpiSummary | null;
  loading: boolean;
  error: string | null;

  setUploadResult: (
    datasetId: string,
    meta: ReportDatasetMeta,
    groupConfig: GroupConfig,
    savedTarget?: SavedTargetMeta | null,
  ) => void;
  setSavedTarget: (target: SavedTargetMeta | null) => void;
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: ReportViewMode) => void;
  setDayReport: (report: DayReport | null) => void;
  setCategoryBreakdown: (breakdown: CategoryBreakdown | null) => void;
  setEmployeePerformance: (performance: EmployeePerformance | null) => void;
  setSeries: (series: DailyCompactRow[]) => void;
  setMonthKpi: (kpi: MonthKpiSummary | null) => void;
  setGroupConfig: (config: GroupConfig) => void;
  setMeta: (meta: ReportDatasetMeta) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  /** Clear sales report only — keep saved target */
  clearSales: () => void;
  reset: () => void;
}

const initial = {
  datasetId: null as string | null,
  meta: null as ReportDatasetMeta | null,
  groupConfig: null as GroupConfig | null,
  savedTarget: null as SavedTargetMeta | null,
  selectedDate: null as string | null,
  viewMode: "overview" as ReportViewMode,
  dayReport: null as DayReport | null,
  categoryBreakdown: null as CategoryBreakdown | null,
  employeePerformance: null as EmployeePerformance | null,
  series: [] as DailyCompactRow[],
  monthKpi: null as MonthKpiSummary | null,
  loading: false,
  error: null as string | null,
};

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      ...initial,

      setUploadResult: (datasetId, meta, groupConfig, savedTarget) =>
        set((state) => ({
          datasetId,
          meta,
          groupConfig,
          savedTarget: savedTarget ?? state.savedTarget,
          selectedDate: meta.dates[meta.dates.length - 1] ?? null,
          viewMode: "overview",
          dayReport: null,
          categoryBreakdown: null,
          employeePerformance: null,
          series: [],
          monthKpi: null,
          error: null,
        })),

      setSavedTarget: (target) => set({ savedTarget: target }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setDayReport: (report) => set({ dayReport: report }),
      setCategoryBreakdown: (breakdown) => set({ categoryBreakdown: breakdown }),
      setEmployeePerformance: (performance) => set({ employeePerformance: performance }),
      setSeries: (series) => set({ series }),
      setMonthKpi: (kpi) => set({ monthKpi: kpi }),
      setGroupConfig: (config) => set({ groupConfig: config }),
      setMeta: (meta) => set({ meta }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      clearSales: () =>
        set((state) => ({
          ...initial,
          savedTarget: state.savedTarget,
        })),

      reset: () => set({ ...initial }),
    }),
    {
      name: "reportbtmh-bao-cao-ngay",
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as { viewMode?: string };
        if (version < 3 && state.viewMode === "all") {
          state.viewMode = "overview";
        }
        return persisted as typeof initial;
      },
      partialize: (state) => ({
        datasetId: state.datasetId,
        meta: state.meta,
        groupConfig: state.groupConfig,
        savedTarget: state.savedTarget,
        selectedDate: state.selectedDate,
        viewMode: state.viewMode,
      }),
    },
  ),
);
