import type { SalesRow } from "./types";

export function filterSalesByDateRange(
  sales: SalesRow[],
  fromDate?: string | null,
  toDate?: string | null,
): SalesRow[] {
  if (!fromDate && !toDate) return sales;
  return sales.filter((r) => {
    if (fromDate && r.date < fromDate) return false;
    if (toDate && r.date > toDate) return false;
    return true;
  });
}

export function clampDateRange(
  fromDate: string | null | undefined,
  toDate: string | null | undefined,
  availableDates: string[],
): { fromDate: string | null; toDate: string | null } {
  if (availableDates.length === 0) return { fromDate: null, toDate: null };

  const sorted = [...availableDates].sort();
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;

  let from = fromDate && fromDate.trim() ? fromDate : null;
  let to = toDate && toDate.trim() ? toDate : null;

  if (from && from < min) from = min;
  if (from && from > max) from = max;
  if (to && to < min) to = min;
  if (to && to > max) to = max;
  if (from && to && from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  return { fromDate: from, toDate: to };
}
