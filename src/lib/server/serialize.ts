/** DuckDB node driver may return BIGINT — JSON.stringify cannot serialize those. */
export function serializeCellValue(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

export function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = serializeCellValue(value);
  }
  return out;
}

export function serializeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(serializeRow);
}
