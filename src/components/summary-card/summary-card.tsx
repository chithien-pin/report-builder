"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDetail } from "@/lib/api-client";
import { formatCellValue, resolveDetailColumns } from "@/lib/column-utils";
import type { ColumnInfo, DateGranularity } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: number | null;
  rowCount: number;
  datasetId: string;
  columns: ColumnInfo[];
  primaryGroupColumn: string;
  secondaryGroupColumns: string[];
  selectedValuesByColumn: Record<string, string[]>;
  primaryValue: string;
  dateGranularity: Record<string, DateGranularity>;
}

export function SummaryCard({
  title,
  value,
  rowCount,
  datasetId,
  columns,
  primaryGroupColumn,
  secondaryGroupColumns,
  selectedValuesByColumn,
  primaryValue,
  dateGranularity,
}: SummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const detailColumns = useMemo(
    () => resolveDetailColumns(columns, rows),
    [columns, rows],
  );

  const toggleDetail = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        const result = await fetchDetail({
          datasetId,
          primaryGroupColumn,
          secondaryGroupColumns,
          primaryValue,
          selectedValuesByColumn,
          dateGranularity,
          limit: 100,
        });
        setRows(result.rows);
        setTotalRows(result.total_rows);
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Card className={expanded ? "col-span-full overflow-hidden" : "overflow-hidden"}>
      <button type="button" className="w-full text-left" onClick={() => void toggleDetail()}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{title}</CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{formatNumber(value)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{rowCount.toLocaleString("vi-VN")} dòng</p>
        </CardContent>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          {loading && <p className="text-sm text-muted-foreground">Đang tải chi tiết...</p>}
          {!loading && rows.length > 0 && (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                {rows.length} / {totalRows.toLocaleString("vi-VN")} dòng · {detailColumns.length} cột
              </p>
              <div className="max-h-[min(70vh,32rem)] overflow-auto rounded-lg border border-border bg-card">
                <table className="min-w-max text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                    <tr>
                      {detailColumns.map((col) => (
                        <th
                          key={col.name}
                          className="whitespace-nowrap border-b border-border px-3 py-2 text-left font-medium"
                        >
                          {col.original_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="border-t border-border/60 hover:bg-muted/30">
                        {detailColumns.map((col) => (
                          <td key={col.name} className="whitespace-nowrap px-3 py-1.5 align-top">
                            {formatCellValue(row[col.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!loading && loaded && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Không có dòng chi tiết.</p>
          )}
        </div>
      )}
    </Card>
  );
}
