"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchColumnValues } from "@/lib/api-client";
import { isSummableColumn, summableColumns } from "@/lib/column-utils";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useDashboardStore } from "@/lib/store";
import type { ColumnInfo, DateGranularity } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterConfigProps {
  columns: ColumnInfo[];
  compact?: boolean;
  dialog?: boolean;
}

const granularityOptions: { value: DateGranularity; label: string }[] = [
  { value: "day", label: "Theo ngày" },
  { value: "week", label: "Theo tuần" },
  { value: "month", label: "Theo tháng" },
];

function GroupConfigCard({
  index,
  column,
  columns,
  allGroupColumns,
  isPrimary,
  compact,
  onRemove,
  onChangeColumn,
  onSetPrimary,
}: {
  index: number;
  column: string;
  columns: ColumnInfo[];
  allGroupColumns: string[];
  isPrimary: boolean;
  compact?: boolean;
  onRemove: () => void;
  onChangeColumn: (newColumn: string) => void;
  onSetPrimary: () => void;
}) {
  const colMeta = columns.find((c) => c.name === column);
  const filterableColumns = columns.filter((c) => c.dtype !== "number" && c.dtype !== "float");

  const datasetId = useDashboardStore((s) => s.datasetId);
  const selectedValuesByColumn = useDashboardStore((s) => s.selectedValuesByColumn);
  const dateGranularity = useDashboardStore((s) => s.dateGranularity);
  const columnValuesCache = useDashboardStore((s) => s.columnValuesCache);
  const valuesLoadingColumn = useDashboardStore((s) => s.valuesLoadingColumn);
  const toggleSelectedValue = useDashboardStore((s) => s.toggleSelectedValue);
  const selectAllValuesForColumn = useDashboardStore((s) => s.selectAllValuesForColumn);
  const clearSelectedValuesForColumn = useDashboardStore((s) => s.clearSelectedValuesForColumn);
  const setDateGranularityForColumn = useDashboardStore((s) => s.setDateGranularityForColumn);
  const setColumnValuesForColumn = useDashboardStore((s) => s.setColumnValuesForColumn);
  const setValuesLoadingColumn = useDashboardStore((s) => s.setValuesLoadingColumn);

  const [search, setSearch] = useState("");
  const [valuesError, setValuesError] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const selected = selectedValuesByColumn[column] ?? [];
  const cached = columnValuesCache[column];
  const columnValues = cached?.values ?? [];
  const columnValuesTotal = cached?.total ?? 0;
  const loading = valuesLoadingColumn === column;

  const loadValues = useCallback(async () => {
    if (!datasetId || !colMeta) return;
    setValuesLoadingColumn(column);
    setValuesError(null);
    try {
      const result = await fetchColumnValues({
        datasetId,
        filterColumn: column,
        dateGranularity: colMeta.dtype === "date" ? (dateGranularity[column] ?? "day") : null,
        search: debouncedSearch,
        limit: 300,
      });
      setColumnValuesForColumn(column, result.values, result.total);
    } catch (err) {
      setColumnValuesForColumn(column, [], 0);
      setValuesError(err instanceof Error ? err.message : "Không tải được giá trị");
    } finally {
      setValuesLoadingColumn(null);
    }
  }, [
    datasetId,
    column,
    colMeta,
    dateGranularity,
    debouncedSearch,
    setColumnValuesForColumn,
    setValuesLoadingColumn,
  ]);

  useEffect(() => {
    void loadValues();
  }, [loadValues]);

  const visibleKeys = useMemo(() => columnValues.map((v) => v.key), [columnValues]);

  if (!colMeta) return null;

  return (
    <div className={cn("rounded-xl border border-border bg-muted/20 p-4", compact && "p-3")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={isPrimary ? "default" : "secondary"}>
              {isPrimary ? "Nhóm chính · Tab" : `Nhóm phụ ${index} · Lọc`}
            </Badge>
            {!isPrimary && (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onSetPrimary}>
                Đặt làm nhóm chính
              </Button>
            )}
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Cột nhóm</Label>
            <Select value={column} onValueChange={onChangeColumn}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterableColumns.map((col) => (
                  <SelectItem
                    key={col.name}
                    value={col.name}
                    disabled={allGroupColumns.includes(col.name) && col.name !== column}
                  >
                    {col.original_name} ({col.dtype})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {colMeta.dtype === "date" && (
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Mức nhóm ngày</Label>
              <Select
                value={dateGranularity[column] ?? "day"}
                onValueChange={(v) => setDateGranularityForColumn(column, v as DateGranularity)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {granularityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title="Xóa nhóm"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Tìm giá trị..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => selectAllValuesForColumn(column, visibleKeys)}
            disabled={visibleKeys.length === 0}
          >
            Chọn tất cả
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => clearSelectedValuesForColumn(column)}
          >
            Bỏ chọn
          </Button>
        </div>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        {loading
          ? "Đang tải giá trị..."
          : `${selected.length} đã chọn / ${columnValuesTotal} giá trị`}
      </p>

      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-1">
        {columnValues.length === 0 && !loading && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {valuesError ?? "Không có giá trị."}
          </p>
        )}
        {valuesError && columnValues.length > 0 && (
          <p className="px-2 pb-2 text-xs text-destructive">{valuesError}</p>
        )}
        {columnValues.map((item) => {
          const checked = selected.includes(item.key);
          return (
            <label
              key={item.key}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                checked ? "bg-primary/10" : "hover:bg-muted/60",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggleSelectedValue(column, item.key)}
              />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="text-xs text-muted-foreground">
                {item.row_count.toLocaleString("vi-VN")} dòng
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function FilterConfig({ columns, compact = false, dialog = false }: FilterConfigProps) {
  const primaryGroupColumn = useDashboardStore((s) => s.primaryGroupColumn);
  const secondaryGroupColumns = useDashboardStore((s) => s.secondaryGroupColumns);
  const sumColumns = useDashboardStore((s) => s.sumColumns);
  const selectedValuesByColumn = useDashboardStore((s) => s.selectedValuesByColumn);
  const addPrimaryGroup = useDashboardStore((s) => s.addPrimaryGroup);
  const addSecondaryGroup = useDashboardStore((s) => s.addSecondaryGroup);
  const removeGroup = useDashboardStore((s) => s.removeGroup);
  const setGroupColumn = useDashboardStore((s) => s.setGroupColumn);
  const setAsPrimaryGroup = useDashboardStore((s) => s.setAsPrimaryGroup);
  const toggleSumColumn = useDashboardStore((s) => s.toggleSumColumn);
  const clearConfig = useDashboardStore((s) => s.clearConfig);

  const hasConfig =
    !!primaryGroupColumn ||
    secondaryGroupColumns.length > 0 ||
    sumColumns.length > 0 ||
    Object.keys(selectedValuesByColumn).length > 0;

  const handleClearConfig = () => {
    if (!hasConfig) return;
    if (!window.confirm("Xóa toàn bộ cấu hình nhóm, filter và cột sum?")) return;
    clearConfig();
  };

  const numericColumns = summableColumns(columns);
  const filterableColumns = columns.filter((c) => {
    const d = c.dtype;
    if (d === "number" || d === "float") return false;
    if (isSummableColumn(c) && d !== "date" && d !== "string") return false;
    return true;
  });
  const allGroups = primaryGroupColumn
    ? [primaryGroupColumn, ...secondaryGroupColumns]
    : secondaryGroupColumns;
  const canAddPrimary = !primaryGroupColumn && allGroups.length < filterableColumns.length;
  const canAddSecondary =
    !!primaryGroupColumn && allGroups.length < filterableColumns.length;

  const comboHint = useMemo(() => {
    if (!primaryGroupColumn) return null;
    const primaryCount = selectedValuesByColumn[primaryGroupColumn]?.length ?? 0;
    if (primaryCount === 0) return "Nhóm chính cần chọn ít nhất 1 giá trị (mỗi giá trị = 1 tab).";
    if (secondaryGroupColumns.some((c) => !(selectedValuesByColumn[c]?.length ?? 0))) {
      return "Mỗi nhóm phụ cần chọn ít nhất 1 giá trị (lọc dữ liệu trong tab).";
    }
    const secLabels = secondaryGroupColumns
      .map((c) => selectedValuesByColumn[c]?.length ?? 0)
      .join(" + ");
    return `${primaryCount} tab · nhóm phụ lọc ${secLabels} giá trị, cộng tổng trong mỗi tab.`;
  }, [primaryGroupColumn, secondaryGroupColumns, selectedValuesByColumn]);

  return (
    <div className={cn("grid gap-6", dialog ? "grid-cols-1 gap-5" : compact ? "gap-4" : "lg:grid-cols-2")}>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="mb-1 text-base font-semibold">Cấu hình nhóm</h2>
            <p className="text-sm text-muted-foreground">
              <strong>Nhóm chính</strong> tạo tab (vd: ngày). <strong>Nhóm phụ</strong> lọc dữ liệu — giá trị được cộng tổng trong tab.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canAddPrimary && (
              <Button type="button" variant="default" size="sm" onClick={() => addPrimaryGroup()}>
                <Plus className="h-4 w-4" />
                Nhóm chính
              </Button>
            )}
            {canAddSecondary && (
              <Button type="button" variant="outline" size="sm" onClick={() => addSecondaryGroup()}>
                <Plus className="h-4 w-4" />
                Nhóm phụ
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasConfig}
              onClick={handleClearConfig}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Xóa cấu hình
            </Button>
          </div>
        </div>

        {!primaryGroupColumn ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="mb-4 text-sm text-muted-foreground">Thêm nhóm chính trước (vd: cột Ngày).</p>
            <Button type="button" onClick={() => addPrimaryGroup()}>
              <Plus className="h-4 w-4" />
              Thêm nhóm chính
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <GroupConfigCard
              key={primaryGroupColumn}
              index={1}
              column={primaryGroupColumn}
              columns={columns}
              allGroupColumns={allGroups}
              isPrimary
              compact={compact}
              onRemove={() => removeGroup(primaryGroupColumn)}
              onChangeColumn={(newCol) => setGroupColumn(primaryGroupColumn, newCol)}
              onSetPrimary={() => {}}
            />

            {secondaryGroupColumns.map((colName, index) => (
              <GroupConfigCard
                key={colName}
                index={index + 1}
                column={colName}
                columns={columns}
                allGroupColumns={allGroups}
                isPrimary={false}
                compact={compact}
                onRemove={() => removeGroup(colName)}
                onChangeColumn={(newCol) => setGroupColumn(colName, newCol)}
                onSetPrimary={() => setAsPrimaryGroup(colName)}
              />
            ))}

            {canAddSecondary && (
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed"
                onClick={() => addSecondaryGroup()}
              >
                <Plus className="h-4 w-4" />
                Thêm nhóm phụ
              </Button>
            )}
          </div>
        )}

        {comboHint && <p className="text-xs text-muted-foreground">{comboHint}</p>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 text-base font-semibold">Cột hiển thị (Sum)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Chọn cột số cần cộng tổng — mỗi cột = 1 card trên dashboard.
        </p>
        {numericColumns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không phát hiện cột số trong file.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {numericColumns.map((col) => (
              <label
                key={col.name}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2 hover:bg-muted/40"
              >
                <Checkbox
                  checked={sumColumns.includes(col.name)}
                  onCheckedChange={() => toggleSumColumn(col.name)}
                />
                <span className="flex-1 text-sm">{col.original_name}</span>
                <Badge variant="secondary">
                  {col.dtype === "date" ? "số*" : col.dtype}
                </Badge>
              </label>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
