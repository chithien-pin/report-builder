"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createDefaultCommissionConfig } from "@/lib/report/commission-defaults";
import type {
  CategoryBreakdown,
  CommissionConfig,
  CustomProductGroup,
  DailyCompactRow,
  DayReport,
  EmployeePerformance,
  GroupConfig,
  MonthKpiSummary,
  OverviewOpsKpi,
  ProductCatalogItem,
  ReportDatasetMeta,
  SavedTargetMeta,
  SkuSalesLine,
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
  opsKpi: OverviewOpsKpi | null;
  loading: boolean;
  error: string | null;
  commissionConfig: CommissionConfig;
  overviewFromDate: string | null;
  overviewToDate: string | null;
  customProductGroups: CustomProductGroup[];
  productCatalog: ProductCatalogItem[];
  skuLines: SkuSalesLine[];
  /** Số khách ghé thăm theo key khoảng ngày (để tính CR). */
  visitorCounts: Record<string, number>;

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
  setOpsKpi: (kpi: OverviewOpsKpi | null) => void;
  setGroupConfig: (config: GroupConfig) => void;
  setCommissionConfig: (config: CommissionConfig) => void;
  setOverviewDateRange: (fromDate: string | null, toDate: string | null) => void;
  setCustomProductGroups: (groups: CustomProductGroup[]) => void;
  upsertCustomProductGroup: (group: CustomProductGroup) => void;
  removeCustomProductGroup: (id: string) => void;
  setSkuData: (catalog: ProductCatalogItem[], lines: SkuSalesLine[]) => void;
  setVisitorCount: (rangeKey: string, count: number) => void;
  setMeta: (meta: ReportDatasetMeta) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  /** Clear sales report only — keep saved target, commission, custom groups */
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
  opsKpi: null as OverviewOpsKpi | null,
  loading: false,
  error: null as string | null,
  commissionConfig: createDefaultCommissionConfig(),
  overviewFromDate: null as string | null,
  overviewToDate: null as string | null,
  customProductGroups: [] as CustomProductGroup[],
  productCatalog: [] as ProductCatalogItem[],
  skuLines: [] as SkuSalesLine[],
  visitorCounts: {} as Record<string, number>,
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
          opsKpi: null,
          overviewFromDate: null,
          overviewToDate: null,
          productCatalog: [],
          skuLines: [],
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
      setOpsKpi: (kpi) => set({ opsKpi: kpi }),
      setGroupConfig: (config) => set({ groupConfig: config }),
      setCommissionConfig: (config) => set({ commissionConfig: config }),
      setOverviewDateRange: (fromDate, toDate) =>
        set({ overviewFromDate: fromDate, overviewToDate: toDate }),
      setCustomProductGroups: (groups) => set({ customProductGroups: groups }),
      upsertCustomProductGroup: (group) =>
        set((state) => {
          const idx = state.customProductGroups.findIndex((g) => g.id === group.id);
          if (idx < 0) {
            return { customProductGroups: [...state.customProductGroups, group] };
          }
          const next = [...state.customProductGroups];
          next[idx] = group;
          return { customProductGroups: next };
        }),
      removeCustomProductGroup: (id) =>
        set((state) => ({
          customProductGroups: state.customProductGroups.filter((g) => g.id !== id),
        })),
      setSkuData: (catalog, lines) => set({ productCatalog: catalog, skuLines: lines }),
      setVisitorCount: (rangeKey, count) =>
        set((state) => ({
          visitorCounts: { ...state.visitorCounts, [rangeKey]: Math.max(0, count) },
        })),
      setMeta: (meta) => set({ meta }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      clearSales: () =>
        set((state) => ({
          ...initial,
          savedTarget: state.savedTarget,
          commissionConfig: state.commissionConfig,
          customProductGroups: state.customProductGroups,
          visitorCounts: state.visitorCounts,
        })),

      reset: () =>
        set((state) => ({
          ...initial,
          commissionConfig: state.commissionConfig,
          customProductGroups: state.customProductGroups,
          visitorCounts: state.visitorCounts,
        })),
    }),
    {
      name: "reportbtmh-bao-cao-ngay",
      version: 7,
      migrate: (persisted, version) => {
        const state = persisted as {
          viewMode?: string;
          commissionConfig?: CommissionConfig;
          overviewFromDate?: string | null;
          overviewToDate?: string | null;
          customProductGroups?: CustomProductGroup[];
          visitorCounts?: Record<string, number>;
        };
        if (version < 3 && state.viewMode === "all") {
          state.viewMode = "overview";
        }
        if (version < 4 || !state.commissionConfig) {
          state.commissionConfig = createDefaultCommissionConfig();
        }
        if (version < 5) {
          state.overviewFromDate = null;
          state.overviewToDate = null;
        }
        if (version < 6) {
          state.customProductGroups = [];
        }
        if (version < 7) {
          state.visitorCounts = {};
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
        commissionConfig: state.commissionConfig,
        overviewFromDate: state.overviewFromDate,
        overviewToDate: state.overviewToDate,
        customProductGroups: state.customProductGroups,
        visitorCounts: state.visitorCounts,
      }),
    },
  ),
);
