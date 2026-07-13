import type { ColumnValueItem, SummaryTab } from "@/lib/types";

export type SummaryRow = {
  tab_key: string;
  tab_label: string;
  segment_key: string;
  segment_label: string;
  row_count: number | bigint;
  [sumCol: string]: unknown;
};

type ValueRow = {
  group_key: string;
  group_label: string;
  row_count: number | bigint;
};

type CountRow = {
  count: number | bigint;
};

export function mapValueRows(rows: ValueRow[]): ColumnValueItem[] {
  return rows.map((row) => ({
    key: String(row.group_key),
    label: String(row.group_label),
    row_count: Number(row.row_count),
  }));
}

export function mapSummaryRows(rows: SummaryRow[], sumColumns: string[]): SummaryTab[] {
  const tabsMap = new Map<string, SummaryTab>();
  const tabOrder: string[] = [];

  for (const row of rows) {
    const tabKey = String(row.tab_key);
    const segmentKey = String(row.segment_key);
    const rowCount = Number(row.row_count);
    const values: Record<string, number | null> = {};

    for (const col of sumColumns) {
      const v = row[col];
      values[col] = v == null ? null : Number(v);
    }

    if (!tabsMap.has(tabKey)) {
      tabsMap.set(tabKey, {
        key: tabKey,
        label: String(row.tab_label),
        row_count: 0,
        segments: [],
      });
      tabOrder.push(tabKey);
    }

    const tab = tabsMap.get(tabKey)!;
    tab.row_count += rowCount;
    tab.segments.push({
      key: segmentKey,
      label: segmentKey !== "__all__" ? String(row.segment_label) : "Tổng",
      row_count: rowCount,
      values,
    });
  }

  return tabOrder.map((k) => tabsMap.get(k)!);
}

export function countFromRow(rows: CountRow[]): number {
  return Number(rows[0]?.count ?? 0);
}
