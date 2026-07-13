import type { ColumnDtype, DateGranularity } from "@/lib/types";

export const GROUP_SEP = " · ";
export const ALL_SEGMENT_KEY = "__all__";

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/** DuckDB expression: normalize mixed date storage (ISO, dd/mm/yyyy, Excel serial, +046203-12 bug strings). */
export function dateParseExpression(quoted: string): string {
  return `COALESCE(
    CASE
      WHEN TRY_CAST(${quoted} AS DATE) IS NOT NULL
        AND EXTRACT(YEAR FROM TRY_CAST(${quoted} AS DATE)) BETWEEN 1900 AND 2100
      THEN TRY_CAST(${quoted} AS DATE)
    END,
    TRY_STRPTIME(CAST(${quoted} AS VARCHAR), '%d/%m/%Y'),
    TRY_STRPTIME(CAST(${quoted} AS VARCHAR), '%Y-%m-%d'),
    CASE
      WHEN TRY_CAST(regexp_extract(CAST(${quoted} AS VARCHAR), '([0-9]{5,})', 1) AS BIGINT) IS NOT NULL
      THEN CAST('1899-12-30' AS DATE) + (
        INTERVAL (CAST(regexp_extract(CAST(${quoted} AS VARCHAR), '([0-9]{5,})', 1) AS BIGINT)
          - CASE WHEN CAST(regexp_extract(CAST(${quoted} AS VARCHAR), '([0-9]{5,})', 1) AS BIGINT) >= 60 THEN 1 ELSE 0 END)
        DAY
      )
    END
  )`;
}

export function valueExpression(
  column: string,
  dtype: string,
  granularity: DateGranularity | null | undefined,
): string {
  const quoted = quoteIdentifier(column);
  if (dtype === "date" && granularity) {
    const parsed = dateParseExpression(quoted);
    if (granularity === "day") {
      return `COALESCE(strftime(${parsed}, '%Y-%m-%d'), CAST(${quoted} AS VARCHAR))`;
    }
    if (granularity === "week") {
      return `COALESCE(strftime(date_trunc('week', ${parsed}), '%Y-W%V'), CAST(${quoted} AS VARCHAR))`;
    }
    if (granularity === "month") {
      return `COALESCE(strftime(date_trunc('month', ${parsed}), '%Y-%m'), CAST(${quoted} AS VARCHAR))`;
    }
  }
  return `CAST(${quoted} AS VARCHAR)`;
}

export function labelExpression(valueExpr: string): string {
  return `COALESCE(CAST(${valueExpr} AS VARCHAR), '(trống)')`;
}

export function columnExprs(
  columns: string[],
  columnTypes: Record<string, ColumnDtype>,
  dateGranularity: Record<string, DateGranularity>,
): { valueExprs: string[]; labelExprs: string[]; groupByParts: string[] } {
  const valueExprs: string[] = [];
  const labelExprs: string[] = [];
  const groupByParts: string[] = [];

  for (const col of columns) {
    const colType = columnTypes[col] ?? "string";
    const gran =
      colType === "date" ? (dateGranularity[col] ?? "day") : dateGranularity[col];
    const expr = valueExpression(col, colType, gran);
    const label = labelExpression(expr);
    valueExprs.push(expr);
    labelExprs.push(label);
    groupByParts.push(expr);
  }

  return { valueExprs, labelExprs, groupByParts };
}

export function valueCondition(valueExpr: string, labelExpr: string, value: string): string {
  if (value === "(trống)") {
    return `(${valueExpr}) IS NULL`;
  }
  return `${labelExpr} = '${escapeLiteral(value)}'`;
}

export function parseSegmentKey(segmentKey: string, secondaryColumns: string[]): string[] {
  if (!secondaryColumns.length || segmentKey === ALL_SEGMENT_KEY || segmentKey === "") {
    return [];
  }
  if (secondaryColumns.length === 1) return [segmentKey];
  return segmentKey.split(GROUP_SEP);
}
