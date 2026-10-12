import { round4 } from "@/lib/check-stock/format";
import type { CategoryId, CountLine, SystemRow } from "@/lib/check-stock/types";

export function normalizePrefix(prefix: string): string {
  return prefix.trim().replace(/\*+$/g, "").toLowerCase();
}

export function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

export type PrefixRef = { lineId: string; norm: string; raw: string };

export function prefixRefs(lines: CountLine[]): PrefixRef[] {
  const refs: PrefixRef[] = [];
  for (const line of lines) {
    if (line.countOnly) continue;
    const seen = new Set<string>();
    for (const prefix of line.prefixes) {
      const norm = normalizePrefix(prefix);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      refs.push({ lineId: line.id, norm, raw: prefix.trim() });
    }
  }
  return refs;
}

/** Đầu mã dài nhất thắng, trên mọi dòng của cả 3 loại. */
export function assignRows(rows: SystemRow[], lines: CountLine[]): Map<string, string> {
  const prefixes = prefixRefs(lines).sort((a, b) => b.norm.length - a.norm.length || a.lineId.localeCompare(b.lineId));
  const assigned = new Map<string, string>();
  for (const row of rows) {
    const code = normalizeCode(row.maHang);
    if (!code) continue;
    const hit = prefixes.find((item) => code.startsWith(item.norm));
    if (hit) assigned.set(code, hit.lineId);
  }
  return assigned;
}

export type LineStats = {
  count: number;
  sl: number;
  tl: number;
  rawWeight: number;
  samples: string[];
};

export function statsForLine(line: CountLine, rows: SystemRow[], assignment: Map<string, string>): LineStats {
  const matched = rows.filter((row) => assignment.get(normalizeCode(row.maHang)) === line.id);
  const sl = round4(matched.reduce((sum, row) => sum + row.sl, 0));
  const summedWeight = round4(matched.reduce((sum, row) => sum + (row.trongLuong ?? 0), 0));
  const tl = line.unitWeight != null ? round4(sl * line.unitWeight) : summedWeight;
  return {
    count: matched.length,
    sl,
    tl,
    rawWeight: summedWeight,
    samples: matched.slice(0, 20).map((row) => row.maHang),
  };
}

export type CategoryTally = Record<CategoryId, { codes: number; sl: number }>;

export function emptyTally(): CategoryTally {
  return {
    loai1: { codes: 0, sl: 0 },
    loai2: { codes: 0, sl: 0 },
    loai3: { codes: 0, sl: 0 },
  };
}

export function summarize(rows: SystemRow[], lines: CountLine[]) {
  const assignment = assignRows(rows, lines);
  const per = emptyTally();
  const lineById = new Map(lines.map((line) => [line.id, line]));
  let codes = 0;
  let sl = 0;
  for (const row of rows) {
    const lineId = assignment.get(normalizeCode(row.maHang));
    if (!lineId) {
      codes += 1;
      sl += row.sl;
      continue;
    }
    const line = lineById.get(lineId);
    if (!line) continue;
    per[line.category].codes += 1;
    per[line.category].sl = round4(per[line.category].sl + row.sl);
  }
  return { assignment, per, ungrouped: { codes, sl: round4(sl) } };
}

export function duplicatePrefixes(lines: CountLine[]): string[] {
  const owner = new Map<string, string>();
  const dupes = new Set<string>();
  for (const line of lines) {
    const local = new Set<string>();
    for (const prefix of line.prefixes) {
      const norm = normalizePrefix(prefix);
      if (!norm) continue;
      if (local.has(norm)) dupes.add(prefix.trim());
      local.add(norm);
      const other = owner.get(norm);
      if (other && other !== line.id) dupes.add(prefix.trim());
      else owner.set(norm, line.id);
    }
  }
  return [...dupes];
}

export type Overlap = { shorter: string; longer: string };

export function overlappingPrefixes(lines: CountLine[]): Overlap[] {
  const unique = new Map<string, string>();
  for (const ref of prefixRefs(lines)) {
    if (!unique.has(ref.norm)) unique.set(ref.norm, ref.raw);
  }
  const items = [...unique.entries()];
  const overlaps: Overlap[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const [a, aRaw] = items[i];
      const [b, bRaw] = items[j];
      if (a === b) continue;
      if (a.startsWith(b)) overlaps.push({ shorter: bRaw, longer: aRaw });
      else if (b.startsWith(a)) overlaps.push({ shorter: aRaw, longer: bRaw });
    }
  }
  return overlaps;
}

export function replacePrefixes(lines: CountLine[], lineId: string, prefixes: string[]): CountLine[] {
  return lines.map((line) => (line.id === lineId ? { ...line, prefixes } : line));
}

export type UngroupedBucket = {
  key: string;
  prefix: string;
  tenNhomLon: string;
  tenChungLoai: string;
  count: number;
  sl: number;
  samples: string[];
};

export function suggestPrefix(row: SystemRow): { prefix: string; groupKey: string } {
  const nhomLon = (row.nhomLon ?? "").trim();
  const chungLoai = (row.chungLoai ?? "").trim();
  if (nhomLon && chungLoai) {
    return { prefix: `${nhomLon}${chungLoai}`, groupKey: `combo:${nhomLon}\n${chungLoai}` };
  }
  const code = row.maHang.trim();
  const dash = code.indexOf("-");
  const prefix = (dash > 0 ? code.slice(0, dash) : code).trim();
  return { prefix, groupKey: `code:${prefix.toLowerCase()}` };
}

export function ungroupedBuckets(rows: SystemRow[], lines: CountLine[]): UngroupedBucket[] {
  const assignment = assignRows(rows, lines);
  const buckets = new Map<string, UngroupedBucket>();
  for (const row of rows) {
    if (assignment.has(normalizeCode(row.maHang))) continue;
    const suggested = suggestPrefix(row);
    let bucket = buckets.get(suggested.groupKey);
    if (!bucket) {
      bucket = {
        key: suggested.groupKey,
        prefix: suggested.prefix,
        tenNhomLon: row.tenNhomLon ?? "",
        tenChungLoai: row.tenChungLoai ?? "",
        count: 0,
        sl: 0,
        samples: [],
      };
      buckets.set(suggested.groupKey, bucket);
    }
    bucket.count += 1;
    bucket.sl = round4(bucket.sl + row.sl);
    if (bucket.samples.length < 3) bucket.samples.push(row.maHang);
    if (!bucket.tenNhomLon && row.tenNhomLon) bucket.tenNhomLon = row.tenNhomLon;
    if (!bucket.tenChungLoai && row.tenChungLoai) bucket.tenChungLoai = row.tenChungLoai;
  }
  return [...buckets.values()].sort((a, b) => b.sl - a.sl || b.count - a.count || a.prefix.localeCompare(b.prefix));
}
