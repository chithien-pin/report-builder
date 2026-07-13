"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  ColumnValueItem,
  DatasetMeta,
  DateGranularity,
  SavedConfig,
  SummaryTab,
} from "./types";
import { repairColumns, summableColumns } from "./column-utils";
import { schemaFingerprint } from "./utils";

const CONFIG_STORAGE_KEY = "reportbtmh-configs";

interface DashboardState {
  datasetId: string | null;
  meta: DatasetMeta | null;
  preview: Record<string, unknown>[];
  primaryGroupColumn: string | null;
  secondaryGroupColumns: string[];
  selectedValuesByColumn: Record<string, string[]>;
  sumColumns: string[];
  dateGranularity: Record<string, DateGranularity>;
  tabRenames: Record<string, string>;
  activeTabKey: string | null;
  schemaKey: string | null;
  columnValuesCache: Record<string, { values: ColumnValueItem[]; total: number }>;
  valuesLoadingColumn: string | null;
  summaryTabs: SummaryTab[];
  summaryLoading: boolean;
  summaryError: string | null;
  pendingFilterSetup: boolean;

  setUploadResult: (
    datasetId: string,
    meta: DatasetMeta,
    preview: Record<string, unknown>[],
  ) => void;
  addPrimaryGroup: () => boolean;
  addSecondaryGroup: () => boolean;
  removeGroup: (column: string) => void;
  setGroupColumn: (oldColumn: string, newColumn: string) => void;
  setAsPrimaryGroup: (column: string) => void;
  toggleSelectedValue: (column: string, value: string) => void;
  selectAllValuesForColumn: (column: string, keys: string[]) => void;
  clearSelectedValuesForColumn: (column: string) => void;
  toggleSumColumn: (column: string) => void;
  setDateGranularityForColumn: (column: string, granularity: DateGranularity) => void;
  setColumnValuesForColumn: (column: string, values: ColumnValueItem[], total: number) => void;
  setValuesLoadingColumn: (column: string | null) => void;
  renameTab: (groupKey: string, name: string) => void;
  setActiveTabKey: (key: string | null) => void;
  setSummaryTabs: (tabs: SummaryTab[]) => void;
  setSummaryLoading: (loading: boolean) => void;
  setSummaryError: (error: string | null) => void;
  applySavedConfig: (config: SavedConfig) => void;
  saveConfigForSchema: () => void;
  loadConfigForSchema: (schemaKey: string) => SavedConfig | null;
  clearPendingFilterSetup: () => void;
  clearConfig: () => void;
  reset: () => void;
}

const initialState = {
  datasetId: null as string | null,
  meta: null as DatasetMeta | null,
  preview: [] as Record<string, unknown>[],
  primaryGroupColumn: null as string | null,
  secondaryGroupColumns: [] as string[],
  selectedValuesByColumn: {} as Record<string, string[]>,
  sumColumns: [] as string[],
  dateGranularity: {} as Record<string, DateGranularity>,
  tabRenames: {} as Record<string, string>,
  activeTabKey: null as string | null,
  schemaKey: null as string | null,
  columnValuesCache: {} as Record<string, { values: ColumnValueItem[]; total: number }>,
  valuesLoadingColumn: null as string | null,
  summaryTabs: [] as SummaryTab[],
  summaryLoading: false,
  summaryError: null as string | null,
  pendingFilterSetup: false,
};

function readAllConfigs(): Record<string, SavedConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SavedConfig>) : {};
  } catch {
    return {};
  }
}

function writeAllConfigs(configs: Record<string, SavedConfig>) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configs));
}

function defaultPrimaryColumn(meta: DatasetMeta): string | null {
  const dateCol = meta.columns.find(
    (c) => c.dtype === "date" && /ngay|ngày|date/i.test(c.original_name || c.name),
  );
  if (dateCol) return dateCol.name;
  const anyDate = meta.columns.find((c) => c.dtype === "date");
  if (anyDate) return anyDate.name;
  const textCol = meta.columns.find((c) => c.dtype === "string");
  return textCol?.name ?? meta.columns.find((c) => c.dtype !== "number" && c.dtype !== "float")?.name ?? null;
}

function allGroupColumns(primary: string | null, secondary: string[]): string[] {
  return primary ? [primary, ...secondary] : secondary;
}

function firstAvailableColumn(meta: DatasetMeta, used: string[]): string | null {
  const usedSet = new Set(used);
  const col = meta.columns.find(
    (c) => c.dtype !== "number" && c.dtype !== "float" && !usedSet.has(c.name),
  );
  return col?.name ?? null;
}

function initGranularity(
  meta: DatasetMeta,
  columns: string[],
  existing: Record<string, DateGranularity>,
): Record<string, DateGranularity> {
  const next = { ...existing };
  for (const col of columns) {
    const colMeta = meta.columns.find((c) => c.name === col);
    if (colMeta?.dtype === "date" && !next[col]) {
      next[col] = "day";
    }
  }
  return next;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUploadResult: (datasetId, meta, preview) => {
        const fixedMeta = { ...meta, columns: repairColumns(meta.columns) };
        const schemaKey = schemaFingerprint(fixedMeta.columns.map((c) => c.name));
        const numericDefaults = summableColumns(fixedMeta.columns).map((c) => c.name);
        const saved = get().loadConfigForSchema(schemaKey);

        const primaryGroupColumn = saved?.primaryGroupColumn ?? defaultPrimaryColumn(fixedMeta);
        const secondaryGroupColumns = saved?.secondaryGroupColumns ?? [];
        const groupCols = allGroupColumns(primaryGroupColumn, secondaryGroupColumns);
        const dateGranularity = initGranularity(
          fixedMeta,
          groupCols,
          saved?.dateGranularity ?? {},
        );

        set({
          datasetId,
          meta: fixedMeta,
          preview,
          schemaKey,
          primaryGroupColumn,
          secondaryGroupColumns,
          selectedValuesByColumn: saved?.selectedValuesByColumn ?? {},
          sumColumns: saved?.sumColumns.length ? saved.sumColumns : numericDefaults.slice(0, 3),
          dateGranularity,
          tabRenames: saved?.tabRenames ?? {},
          activeTabKey: null,
          columnValuesCache: {},
          valuesLoadingColumn: null,
          summaryTabs: [],
          summaryError: null,
          pendingFilterSetup: true,
        });
      },

      addPrimaryGroup: () => {
        const { meta, primaryGroupColumn, secondaryGroupColumns } = get();
        if (!meta || primaryGroupColumn) return false;
        const nextCol = firstAvailableColumn(meta, secondaryGroupColumns);
        if (!nextCol) return false;
        const colMeta = meta.columns.find((c) => c.name === nextCol);
        set((state) => ({
          primaryGroupColumn: nextCol,
          selectedValuesByColumn: { ...state.selectedValuesByColumn, [nextCol]: [] },
          dateGranularity:
            colMeta?.dtype === "date"
              ? { ...state.dateGranularity, [nextCol]: "day" as DateGranularity }
              : state.dateGranularity,
          activeTabKey: null,
          summaryTabs: [],
        }));
        return true;
      },

      addSecondaryGroup: () => {
        const { meta, primaryGroupColumn, secondaryGroupColumns } = get();
        if (!meta || !primaryGroupColumn) return false;
        const used = allGroupColumns(primaryGroupColumn, secondaryGroupColumns);
        const nextCol = firstAvailableColumn(meta, used);
        if (!nextCol) return false;
        const colMeta = meta.columns.find((c) => c.name === nextCol);
        set((state) => ({
          secondaryGroupColumns: [...state.secondaryGroupColumns, nextCol],
          selectedValuesByColumn: { ...state.selectedValuesByColumn, [nextCol]: [] },
          dateGranularity:
            colMeta?.dtype === "date"
              ? { ...state.dateGranularity, [nextCol]: "day" as DateGranularity }
              : state.dateGranularity,
          activeTabKey: null,
          summaryTabs: [],
        }));
        return true;
      },

      removeGroup: (column) => {
        set((state) => {
          const nextSelected = { ...state.selectedValuesByColumn };
          const nextGranularity = { ...state.dateGranularity };
          const nextCache = { ...state.columnValuesCache };
          delete nextSelected[column];
          delete nextGranularity[column];
          delete nextCache[column];

          let primary = state.primaryGroupColumn;
          let secondary = state.secondaryGroupColumns;

          if (primary === column) {
            primary = secondary[0] ?? null;
            secondary = secondary.slice(1);
          } else {
            secondary = secondary.filter((c) => c !== column);
          }

          return {
            primaryGroupColumn: primary,
            secondaryGroupColumns: secondary,
            selectedValuesByColumn: nextSelected,
            dateGranularity: nextGranularity,
            columnValuesCache: nextCache,
            activeTabKey: null,
            summaryTabs: [],
          };
        });
      },

      setGroupColumn: (oldColumn, newColumn) => {
        if (oldColumn === newColumn) return;
        set((state) => {
          const used = allGroupColumns(state.primaryGroupColumn, state.secondaryGroupColumns);
          if (used.includes(newColumn)) return state;

          const colMeta = state.meta?.columns.find((c) => c.name === newColumn);
          const nextSelected = { ...state.selectedValuesByColumn };
          const nextGranularity = { ...state.dateGranularity };
          const nextCache = { ...state.columnValuesCache };
          delete nextSelected[oldColumn];
          delete nextGranularity[oldColumn];
          delete nextCache[oldColumn];
          nextSelected[newColumn] = [];
          if (colMeta?.dtype === "date") nextGranularity[newColumn] = "day";

          let primary = state.primaryGroupColumn;
          let secondary = state.secondaryGroupColumns;
          if (primary === oldColumn) primary = newColumn;
          else secondary = secondary.map((c) => (c === oldColumn ? newColumn : c));

          return {
            primaryGroupColumn: primary,
            secondaryGroupColumns: secondary,
            selectedValuesByColumn: nextSelected,
            dateGranularity: nextGranularity,
            columnValuesCache: nextCache,
            activeTabKey: null,
            summaryTabs: [],
          };
        });
      },

      setAsPrimaryGroup: (column) => {
        set((state) => {
          if (state.primaryGroupColumn === column) return state;
          let primary = column;
          let secondary = [...state.secondaryGroupColumns];
          if (state.primaryGroupColumn) {
            secondary = secondary.filter((c) => c !== column);
            secondary.unshift(state.primaryGroupColumn);
          } else {
            secondary = secondary.filter((c) => c !== column);
          }
          return {
            primaryGroupColumn: primary,
            secondaryGroupColumns: secondary,
            activeTabKey: null,
            summaryTabs: [],
          };
        });
      },

      toggleSelectedValue: (column, value) =>
        set((state) => {
          const current = state.selectedValuesByColumn[column] ?? [];
          const next = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value];
          return {
            selectedValuesByColumn: { ...state.selectedValuesByColumn, [column]: next },
            activeTabKey: null,
          };
        }),

      selectAllValuesForColumn: (column, keys) =>
        set((state) => ({
          selectedValuesByColumn: { ...state.selectedValuesByColumn, [column]: keys },
          activeTabKey: null,
        })),

      clearSelectedValuesForColumn: (column) =>
        set((state) => ({
          selectedValuesByColumn: { ...state.selectedValuesByColumn, [column]: [] },
          activeTabKey: null,
        })),

      toggleSumColumn: (column) =>
        set((state) => ({
          sumColumns: state.sumColumns.includes(column)
            ? state.sumColumns.filter((c) => c !== column)
            : [...state.sumColumns, column],
        })),

      setDateGranularityForColumn: (column, granularity) =>
        set((state) => ({
          dateGranularity: { ...state.dateGranularity, [column]: granularity },
          selectedValuesByColumn: { ...state.selectedValuesByColumn, [column]: [] },
          columnValuesCache: { ...state.columnValuesCache, [column]: { values: [], total: 0 } },
          activeTabKey: null,
          summaryTabs: [],
        })),

      setColumnValuesForColumn: (column, values, total) =>
        set((state) => ({
          columnValuesCache: { ...state.columnValuesCache, [column]: { values, total } },
        })),

      setValuesLoadingColumn: (column) => set({ valuesLoadingColumn: column }),

      renameTab: (groupKey, name) =>
        set((state) => ({
          tabRenames: { ...state.tabRenames, [groupKey]: name.trim() },
        })),

      setActiveTabKey: (key) => set({ activeTabKey: key }),
      setSummaryTabs: (tabs) => set({ summaryTabs: tabs, summaryError: null }),
      setSummaryLoading: (loading) => set({ summaryLoading: loading }),
      setSummaryError: (error) => set({ summaryError: error }),

      applySavedConfig: (config) =>
        set({
          primaryGroupColumn: config.primaryGroupColumn,
          secondaryGroupColumns: config.secondaryGroupColumns,
          selectedValuesByColumn: config.selectedValuesByColumn,
          sumColumns: config.sumColumns,
          dateGranularity: config.dateGranularity,
          tabRenames: config.tabRenames,
          columnValuesCache: {},
          summaryTabs: [],
          activeTabKey: null,
        }),

      saveConfigForSchema: () => {
        const {
          schemaKey,
          primaryGroupColumn,
          secondaryGroupColumns,
          selectedValuesByColumn,
          sumColumns,
          dateGranularity,
          tabRenames,
        } = get();
        if (!schemaKey) return;
        const configs = readAllConfigs();
        configs[schemaKey] = {
          primaryGroupColumn,
          secondaryGroupColumns,
          selectedValuesByColumn,
          sumColumns,
          dateGranularity,
          tabRenames,
        };
        writeAllConfigs(configs);
      },

      loadConfigForSchema: (schemaKey) => {
        const raw = readAllConfigs()[schemaKey];
        if (!raw) return null;

        const legacy = raw as SavedConfig & {
          filterColumns?: string[];
          filterColumn?: string | null;
          selectedValues?: string[];
        };

        if (legacy.primaryGroupColumn !== undefined) return raw;

        if (legacy.filterColumns?.length) {
          const [primary, ...secondary] = legacy.filterColumns;
          return {
            primaryGroupColumn: primary ?? null,
            secondaryGroupColumns: secondary,
            selectedValuesByColumn: legacy.selectedValuesByColumn ?? {},
            sumColumns: legacy.sumColumns ?? [],
            dateGranularity: legacy.dateGranularity ?? {},
            tabRenames: legacy.tabRenames ?? {},
          };
        }

        if (legacy.filterColumn) {
          const col = legacy.filterColumn;
          return {
            primaryGroupColumn: col,
            secondaryGroupColumns: [],
            selectedValuesByColumn: { [col]: legacy.selectedValues ?? [] },
            sumColumns: legacy.sumColumns ?? [],
            dateGranularity:
              typeof legacy.dateGranularity === "string"
                ? { [col]: legacy.dateGranularity as DateGranularity }
                : (legacy.dateGranularity ?? {}),
            tabRenames: legacy.tabRenames ?? {},
          };
        }

        return raw;
      },

      clearPendingFilterSetup: () => set({ pendingFilterSetup: false }),

      clearConfig: () => {
        const { schemaKey } = get();
        if (schemaKey) {
          const configs = readAllConfigs();
          delete configs[schemaKey];
          writeAllConfigs(configs);
        }
        set({
          primaryGroupColumn: null,
          secondaryGroupColumns: [],
          selectedValuesByColumn: {},
          sumColumns: [],
          dateGranularity: {},
          tabRenames: {},
          activeTabKey: null,
          columnValuesCache: {},
          valuesLoadingColumn: null,
          summaryTabs: [],
          summaryError: null,
          summaryLoading: false,
        });
      },

      reset: () => set({ ...initialState }),
    }),
    {
      name: "reportbtmh-dashboard",
      version: 5,
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>;
        if (state.meta && typeof state.meta === "object") {
          const meta = state.meta as DatasetMeta;
          if (Array.isArray(meta.columns)) {
            state.meta = { ...meta, columns: repairColumns(meta.columns) };
          }
        }

        if (state.primaryGroupColumn !== undefined) return state;

        if (Array.isArray(state.filterColumns) && state.filterColumns.length > 0) {
          const cols = state.filterColumns as string[];
          return {
            ...state,
            primaryGroupColumn: cols[0],
            secondaryGroupColumns: cols.slice(1),
            filterColumns: undefined,
          };
        }

        return state;
      },
      partialize: (state) => ({
        datasetId: state.datasetId,
        meta: state.meta
          ? { ...state.meta, columns: repairColumns(state.meta.columns) }
          : state.meta,
        preview: state.preview,
        primaryGroupColumn: state.primaryGroupColumn,
        secondaryGroupColumns: state.secondaryGroupColumns,
        selectedValuesByColumn: state.selectedValuesByColumn,
        sumColumns: state.sumColumns,
        dateGranularity: state.dateGranularity,
        tabRenames: state.tabRenames,
        activeTabKey: state.activeTabKey,
        schemaKey: state.schemaKey,
      }),
    },
  ),
);

export function hasValidFilterSelection(
  primaryGroupColumn: string | null,
  secondaryGroupColumns: string[],
  selectedValuesByColumn: Record<string, string[]>,
): boolean {
  if (!primaryGroupColumn) return false;
  const cols = allGroupColumns(primaryGroupColumn, secondaryGroupColumns);
  return cols.every((col) => (selectedValuesByColumn[col]?.length ?? 0) > 0);
}

export function getAllGroupColumns(
  primaryGroupColumn: string | null,
  secondaryGroupColumns: string[],
): string[] {
  return allGroupColumns(primaryGroupColumn, secondaryGroupColumns);
}
