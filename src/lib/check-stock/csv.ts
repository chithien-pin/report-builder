import { calcLine } from "@/lib/check-stock/calc";
import { csvEscape, formatIsoDate, round4 } from "@/lib/check-stock/format";
import { assignRows } from "@/lib/check-stock/match";
import { positionColumns, sectionsFor, templateOf } from "@/lib/check-stock/templates";
import type { CountLine, SessionDoc, SystemRow } from "@/lib/check-stock/types";

export type SheetColumn =
  | { kind: "pos"; key: string; label: string; decimal: boolean }
  | { kind: "totalQty" | "systemQty" | "qtyDiff" | "actualWeight" | "systemWeight" | "weightDiff"; label: string }
  | { kind: "note"; label: string };

export function sheetColumns(lines: CountLine[], sectionId: string): SheetColumn[] {
  const sample = lines.find((line) => line.section === sectionId);
  const category = sample?.category ?? "loai1";
  const template = templateOf(category);
  const positions = positionColumns(category, sectionId);
  const weightSection = Boolean(template.sections.find((item) => item.id === sectionId)?.weight);
  const anyWeight = weightSection || lines.some((line) => line.mode === "weight");
  const anyQty = lines.some((line) => line.mode !== "weight" && !line.countOnly);
  const showWeight = template.weightColumns || anyWeight || lines.some((line) => line.unitWeight != null);
  const decimalPos = anyWeight && !anyQty;
  const columns: SheetColumn[] = positions.map((column) => ({
    kind: "pos",
    key: column.key,
    label: column.label,
    decimal: decimalPos || (column.key === "hangMuaLai" && anyWeight),
  }));
  if (anyQty && !weightSection) {
    const totalLabel = template.weightColumns ? "Tổng SL" : "TỔNG";
    const systemLabel = template.weightColumns ? "SL Augges" : "AUGGES";
    const diffLabel = template.weightColumns ? "SL chênh lệch" : "CHÊNH LỆCH";
    columns.push({ kind: "totalQty", label: totalLabel }, { kind: "systemQty", label: systemLabel }, { kind: "qtyDiff", label: diffLabel });
  }
  if (showWeight) {
    columns.push(
      { kind: "actualWeight", label: template.weightColumns ? "Tổng TL Thực tế" : "Tổng TL" },
      { kind: "systemWeight", label: template.weightColumns ? "TL Augges" : "TL hệ thống" },
      { kind: "weightDiff", label: "CHÊNH LỆCH" },
    );
  }
  columns.push({ kind: "note", label: "Ghi chú" });
  return columns;
}

function num(value: number): string {
  return String(round4(value));
}

function rowText(cells: (string | number)[], blanks: number): string {
  return [...Array.from({ length: blanks }, () => ""), ...cells].map(csvEscape).join(",");
}

export function buildCsv(lines: CountLine[], session: SessionDoc, rows: SystemRow[], qtyTolerance: number) {
  const template = templateOf(session.category);
  const categoryLines = lines.filter((line) => line.category === session.category);
  const extra = [...new Set(categoryLines.map((line) => line.section))];
  const sections = sectionsFor(session.category, extra);
  const assignment = assignRows(rows, lines);
  const records: string[] = [
    rowText([template.title], template.leadingBlanks),
    rowText(["Ngày", formatIsoDate(session.date), "Giờ", session.time, "Ca", session.ca], template.leadingBlanks),
  ];

  for (const section of sections) {
    const sectionLines = categoryLines
      .filter((line) => line.section === section.id)
      .sort((a, b) => a.order - b.order);
    if (sectionLines.length === 0) continue;
    const columns = sheetColumns(sectionLines, section.id);
    const calcs = sectionLines.map((line) => calcLine(line, session, rows, assignment, qtyTolerance));
    records.push(rowText([section.title], template.leadingBlanks));
    records.push(rowText(["Dòng", ...columns.map((column) => column.label)], template.leadingBlanks));
    const totals = new Map<string, number>();
    for (const calc of calcs) {
      const label = calc.line.countOnly ? `${calc.line.label}: ${num(calc.totalQty)}` : calc.line.label;
      const values = columns.map((column) => {
        if (calc.line.countOnly) {
          if (column.kind === "note") return calc.note;
          return "";
        }
        if (column.kind === "pos") {
          const value = calc.positions[column.key] ?? 0;
          addTotal(totals, column.key, value);
          return num(value);
        }
        if (column.kind === "note") return calc.note;
        if (column.kind === "qtyDiff" && calc.line.mode === "weight") return "";
        const value = valueOf(calc, column.kind);
        if (value == null) return "";
        addTotal(totals, column.kind, value);
        return num(value);
      });
      records.push(rowText([label, ...values], template.leadingBlanks));
    }
    const totalValues = columns.map((column) => {
      if (column.kind === "note") return "";
      const key = column.kind === "pos" ? column.key : column.kind;
      const value = totals.get(key);
      return value == null ? "" : num(value);
    });
    records.push(rowText(["Tổng", ...totalValues], template.leadingBlanks));
  }

  records.push(rowText(["Người kiểm hàng", session.inspector], template.leadingBlanks));
  records.push(rowText(["Kiểm soát", session.controller], template.leadingBlanks));
  const hm = /^(\d{1,2}):(\d{2})$/.exec(session.time);
  const hhmm = hm ? `${hm[1].padStart(2, "0")}${hm[2]}` : "0000";
  const ymd = session.date.replaceAll("-", "");
  return {
    filename: `kiem-ke_${template.slug}_${ymd}_${hhmm}.csv`,
    text: `\uFEFF${records.join("\r\n")}`,
  };
}

function addTotal(totals: Map<string, number>, key: string, value: number) {
  totals.set(key, round4((totals.get(key) ?? 0) + value));
}

function valueOf(
  calc: ReturnType<typeof calcLine>,
  kind: Exclude<SheetColumn["kind"], "pos" | "note">,
): number | null {
  if (kind === "totalQty") return calc.totalQty;
  if (kind === "systemQty") return calc.systemQty;
  if (kind === "qtyDiff") return calc.shownQtyDiff;
  if (kind === "actualWeight") return calc.actualWeight;
  if (kind === "systemWeight") return calc.systemWeight;
  return calc.shownWeightDiff;
}
