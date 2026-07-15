import type { GroupConfig, ReportGroup } from "./types";

function gid(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const DEFAULT_GROUPS: Omit<ReportGroup, "targetDtColumn" | "targetSlColumn">[] = [
  {
    id: gid("Vàng tích lũy"),
    name: "Vàng tích lũy",
    productLines: ["KGB", "Tiểu kim cát", "SJC"],
    slUnit: "chi",
  },
  {
    id: gid("Vàng tích lũy Quà tặng"),
    name: "Vàng tích lũy Quà tặng",
    productLines: ["24K Quà tặng", "Quà tặng"],
    slUnit: "chiec",
  },
  {
    id: gid("Vàng TS 24K"),
    name: "Vàng TS 24K",
    productLines: ["24K Đá màu", "3D", "CN", "CNC", "PT"],
    slUnit: "chiec",
  },
  {
    id: gid("TS vàng tây"),
    name: "TS vàng tây",
    productLines: [
      "Nhẫn Cưới",
      "Nhẫn Cưới Kim Cương",
      "PC Hàn Quốc",
      "PC Ý 10K",
      "PC Ý 18K",
      "TS Kim cương",
      "TS Nhập khẩu",
      "VT Đá màu",
      "BST",
      "Kim cương viên",
    ],
    slUnit: "chiec",
  },
  {
    id: gid("Bạc tích lũy"),
    name: "Bạc tích lũy",
    productLines: ["Bạc tích lũy"],
    slUnit: "chi",
  },
  {
    id: gid("Khác"),
    name: "Khác",
    productLines: ["Bạc", "Phong Thủy"],
    slUnit: "chiec",
  },
];

/** Heuristic: map common target.csv headers → default groups */
const DEFAULT_TARGET_HINTS: Record<string, { dt?: string[]; sl?: string[] }> = {
  [gid("Vàng tích lũy")]: {
    dt: ["vang tt"],
    sl: ["vang tt (chi)"],
  },
  [gid("Bạc tích lũy")]: {
    dt: ["bac tt"],
    sl: ["bac tt (chi)"],
  },
  [gid("Vàng TS 24K")]: {
    dt: ["trang suc vang ta"],
    sl: ["trang suc vang ta (chiec)"],
  },
  [gid("TS vàng tây")]: {
    dt: ["trang suc khac"],
    sl: ["trang suc khac (chiec)"],
  },
};

function normLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function colBaseLabel(label: string): string {
  // "Vàng TT · Doanh thu Kế hoạch" → "vang tt"
  return normLabel(label.split("·")[0] ?? label);
}

function findColumn(
  columns: { key: string; label: string; kind: string }[],
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

export function createDefaultGroupConfig(
  targetColumns: { key: string; label: string; kind: "dt" | "sl" | "other" }[] = [],
): GroupConfig {
  const groups: ReportGroup[] = DEFAULT_GROUPS.map((g) => {
    const hints = DEFAULT_TARGET_HINTS[g.id];
    return {
      ...g,
      targetDtColumn: hints?.dt ? findColumn(targetColumns, hints.dt, "dt") : null,
      targetSlColumn: hints?.sl ? findColumn(targetColumns, hints.sl, "sl") : null,
    };
  });

  return {
    groups,
    fallbackGroupId: gid("Khác"),
  };
}

export function newEmptyGroup(name: string): ReportGroup {
  return {
    id: `${gid(name)}-${Date.now()}`,
    name,
    productLines: [],
    slUnit: "chiec",
    targetDtColumn: null,
    targetSlColumn: null,
  };
}
