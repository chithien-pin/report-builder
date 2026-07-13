"use client";

import { useDashboardStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

export function FilterSummary() {
  const meta = useDashboardStore((s) => s.meta);
  const primaryGroupColumn = useDashboardStore((s) => s.primaryGroupColumn);
  const secondaryGroupColumns = useDashboardStore((s) => s.secondaryGroupColumns);
  const selectedValuesByColumn = useDashboardStore((s) => s.selectedValuesByColumn);
  const sumColumns = useDashboardStore((s) => s.sumColumns);

  if (!meta || !primaryGroupColumn) {
    return <span className="text-sm text-muted-foreground">Chưa cấu hình nhóm chính</span>;
  }

  const primaryLabel =
    meta.columns.find((c) => c.name === primaryGroupColumn)?.original_name ?? primaryGroupColumn;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default" className="font-normal">
        Tab · {primaryLabel}: {selectedValuesByColumn[primaryGroupColumn]?.length ?? 0} giá trị
      </Badge>
      {secondaryGroupColumns.map((col) => {
        const label = meta.columns.find((c) => c.name === col)?.original_name ?? col;
        const count = selectedValuesByColumn[col]?.length ?? 0;
        return (
          <Badge key={col} variant="outline" className="font-normal">
          Card · {label}: {count} giá trị (lọc)
          </Badge>
        );
      })}
      {sumColumns.length > 0 && (
        <Badge variant="secondary" className="font-normal">
          Sum: {sumColumns.length} cột
        </Badge>
      )}
    </div>
  );
}
