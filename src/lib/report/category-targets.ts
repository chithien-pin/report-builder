import type { TargetColumn, TargetData } from "./types";

function normLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function colBaseLabel(label: string): string {
  return normLabel(label.split("·")[0] ?? label);
}

function findColumn(
  columns: TargetColumn[],
  hints: string[],
  kind: "dt" | "sl",
): string | null {
  const normalizedHints = hints.map(normLabel);

  const scored = columns
    .filter((col) => col.kind === kind)
    .map((col) => {
      const base = colBaseLabel(col.label);
      const full = normLabel(col.label);
      let score = 0;
      for (const h of normalizedHints) {
        if (base === h) score = Math.max(score, 100);
        else if (base.includes(h) || h.includes(base)) score = Math.max(score, 80);
        else if (full.includes(h)) score = Math.max(score, 60);
      }
      return { col, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.col.key ?? null;
}

/** Map Danh mục sản phẩm → target CSV column hints (doanh thu). */
export const CATEGORY_TARGET_HINTS: Record<string, string[]> = {
  "Vàng tích lũy": ["vang tt"],
  "Bạc tích lũy": ["bac tt"],
  "TS vàng ta": ["trang suc vang ta"],
  "TS vàng tây": ["trang suc khac"],
  BST: ["trang suc khac"],
  "Hỗn hợp": ["trang suc khac"],
  Khác: ["trang suc khac"],
  "Nguyên liệu": ["trang suc khac"],
};

const FALLBACK_HINTS = ["trang suc khac"];

export function resolveCategoryTargetColumn(
  category: string,
  target: TargetData,
): string | null {
  const hints = CATEGORY_TARGET_HINTS[category] ?? FALLBACK_HINTS;
  return findColumn(target.columns, hints, "dt");
}

export function monthTargetForCategory(category: string, target: TargetData): number {
  const key = resolveCategoryTargetColumn(category, target);
  if (!key) return 0;
  return target.monthTotals[key] ?? 0;
}
