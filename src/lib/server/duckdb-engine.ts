import { all, sqlPath, withConnection } from "@/lib/server/duckdb-client";
import { countFromRow, mapSummaryRows, mapValueRows, type SummaryRow } from "@/lib/server/duckdb-mappers";
import {
  ALL_SEGMENT_KEY,
  columnExprs,
  escapeLiteral,
  labelExpression,
  parseSegmentKey,
  quoteIdentifier,
  valueCondition,
  valueExpression,
} from "@/lib/server/duckdb-sql";
import { serializeRows, serializeCellValue } from "@/lib/server/serialize";
import { loadMeta, resolveParquetPath } from "@/lib/server/storage";
import type {
  ColumnValuesResponse,
  DateGranularity,
  DetailResponse,
  SummaryResponse,
} from "@/lib/types";

export async function listColumnValues(
  datasetId: string,
  filterColumn: string,
  dateGranularity: DateGranularity | null = null,
  search = "",
  limit = 200,
  offset = 0,
): Promise<ColumnValuesResponse> {
  const meta = await loadMeta(datasetId);
  const parquetPath = await resolveParquetPath(datasetId);
  const columnTypes = Object.fromEntries(meta.columns.map((c) => [c.name, c.dtype]));

  if (!(filterColumn in columnTypes)) {
    throw new Error(`Cột '${filterColumn}' không tồn tại trong dataset.`);
  }

  const dtype = columnTypes[filterColumn];
  const gran = dateGranularity ?? (dtype === "date" ? "day" : null);
  const valueExpr = valueExpression(filterColumn, dtype, gran);
  const labelExpr = labelExpression(valueExpr);

  let searchClause = "";
  if (search.trim()) {
    searchClause = `WHERE group_label ILIKE '%${escapeLiteral(search.trim())}%'`;
  }

  const baseQuery = `
    SELECT
      ${labelExpr} AS group_key,
      ${labelExpr} AS group_label,
      COUNT(*) AS row_count
    FROM read_parquet('${sqlPath(parquetPath)}')
    GROUP BY ${valueExpr}
  `;

  const orderClause = dtype === "date" ? "group_key ASC NULLS LAST" : "group_label ASC";

  return withConnection(async (conn) => {
    const totalRows = await all<{ count: number | bigint }>(
      conn,
      `SELECT COUNT(*)::BIGINT AS count FROM (${baseQuery}) t ${searchClause}`,
    );
    const total = countFromRow(totalRows);

    const rows = await all<{ group_key: string; group_label: string; row_count: number | bigint }>(
      conn,
      `
      SELECT group_key, group_label, row_count
      FROM (${baseQuery}) t
      ${searchClause}
      ORDER BY ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
      `,
    );

    return { values: mapValueRows(rows), total, limit, offset };
  });
}

export async function computeSummary(
  datasetId: string,
  primaryColumn: string,
  secondaryColumns: string[],
  selectedValues: Record<string, string[]>,
  sumColumns: string[],
  dateGranularity: Record<string, DateGranularity> = {},
): Promise<SummaryResponse> {
  const meta = await loadMeta(datasetId);
  const parquetPath = await resolveParquetPath(datasetId);
  const columnTypes = Object.fromEntries(meta.columns.map((c) => [c.name, c.dtype]));
  const allGroupCols = [primaryColumn, ...secondaryColumns];

  for (const col of [...allGroupCols, ...sumColumns]) {
    if (!(col in columnTypes)) {
      throw new Error(`Cột '${col}' không tồn tại trong dataset.`);
    }
  }

  for (const col of allGroupCols) {
    if (!selectedValues[col]?.length) {
      throw new Error(`Cột '${col}' chưa chọn giá trị nào.`);
    }
  }

  const { labelExprs: pLabels, groupByParts: pGroup } = columnExprs(
    [primaryColumn],
    columnTypes,
    dateGranularity,
  );
  const primaryLabelExpr = pLabels[0];
  const primaryGroupExpr = pGroup[0];

  let secLabels: string[] = [];
  if (secondaryColumns.length) {
    secLabels = columnExprs(secondaryColumns, columnTypes, dateGranularity).labelExprs;
  }

  const whereParts: string[] = [];
  for (let i = 0; i < allGroupCols.length; i++) {
    const col = allGroupCols[i];
    const labelExpr = i === 0 ? primaryLabelExpr : secLabels[i - 1];
    const literals = selectedValues[col].map((v) => `'${escapeLiteral(v)}'`).join(", ");
    whereParts.push(`${labelExpr} IN (${literals})`);
  }

  const whereSql = whereParts.join(" AND ");
  const sumParts = sumColumns.map(
    (col) => `SUM(TRY_CAST(${quoteIdentifier(col)} AS DOUBLE)) AS "${col}"`,
  );

  const orderClause =
    columnTypes[primaryColumn] === "date" ? "tab_key ASC NULLS LAST" : "tab_key ASC";

  const query = `
    SELECT
      ${primaryLabelExpr} AS tab_key,
      ${primaryLabelExpr} AS tab_label,
      '${ALL_SEGMENT_KEY}' AS segment_key,
      'Tổng' AS segment_label,
      COUNT(*) AS row_count,
      ${sumParts.join(", ")}
    FROM read_parquet('${sqlPath(parquetPath)}')
    WHERE ${whereSql}
    GROUP BY ${primaryGroupExpr}
    ORDER BY ${orderClause}
  `;

  const rows = await withConnection((conn) => all<SummaryRow>(conn, query));
  const tabs = mapSummaryRows(
    rows.map((row) => {
      const out: SummaryRow = { ...row };
      for (const [k, v] of Object.entries(row)) {
        out[k] = serializeCellValue(v) as SummaryRow[string];
      }
      return out;
    }),
    sumColumns,
  );
  return { tabs, total_tabs: tabs.length };
}

export async function fetchValueDetail(
  datasetId: string,
  primaryColumn: string,
  secondaryColumns: string[],
  primaryValue: string,
  segmentKey: string | null = null,
  selectedValues: Record<string, string[]> | null = null,
  dateGranularity: Record<string, DateGranularity> = {},
  limit = 100,
  offset = 0,
): Promise<DetailResponse> {
  const meta = await loadMeta(datasetId);
  const parquetPath = await resolveParquetPath(datasetId);
  const columnTypes = Object.fromEntries(meta.columns.map((c) => [c.name, c.dtype]));

  const { valueExprs: pValue, labelExprs: pLabels } = columnExprs(
    [primaryColumn],
    columnTypes,
    dateGranularity,
  );
  const conditions = [valueCondition(pValue[0], pLabels[0], primaryValue)];

  if (secondaryColumns.length && segmentKey && segmentKey !== ALL_SEGMENT_KEY) {
    const secValues = parseSegmentKey(segmentKey, secondaryColumns);
    const { valueExprs: secValue, labelExprs: secLabels } = columnExprs(
      secondaryColumns,
      columnTypes,
      dateGranularity,
    );
    secondaryColumns.forEach((_, i) => {
      conditions.push(valueCondition(secValue[i], secLabels[i], secValues[i] ?? ""));
    });
  } else if (secondaryColumns.length && selectedValues) {
    const { labelExprs: secLabels } = columnExprs(
      secondaryColumns,
      columnTypes,
      dateGranularity,
    );
    secondaryColumns.forEach((col, i) => {
      const vals = selectedValues[col] ?? [];
      if (vals.length) {
        const literals = vals.map((v) => `'${escapeLiteral(v)}'`).join(", ");
        conditions.push(`${secLabels[i]} IN (${literals})`);
      }
    });
  }

  const whereSql = conditions.join(" AND ");

  return withConnection(async (conn) => {
    const totalResult = await all<{ count: number | bigint }>(
      conn,
      `SELECT COUNT(*)::BIGINT AS count FROM read_parquet('${sqlPath(parquetPath)}') WHERE ${whereSql}`,
    );
    const totalRows = countFromRow(totalResult);

    const rows = await all<Record<string, unknown>>(
      conn,
      `
      SELECT * FROM read_parquet('${sqlPath(parquetPath)}')
      WHERE ${whereSql}
      LIMIT ${limit} OFFSET ${offset}
      `,
    );

    return { rows: serializeRows(rows), total_rows: totalRows, limit, offset };
  });
}
