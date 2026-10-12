import { round4 } from "@/lib/check-stock/format";
import { assignRows, statsForLine, type LineStats } from "@/lib/check-stock/match";
import { positionColumns, sectionIsWeight, templateOf } from "@/lib/check-stock/templates";
import type { CountLine, SessionDoc, SystemRow } from "@/lib/check-stock/types";

export type LineCalc = {
  line: CountLine;
  positions: Record<string, number>;
  totalQty: number;
  systemQty: number;
  qtyDiff: number;
  shownQtyDiff: number;
  qtyAlert: boolean;
  actualWeight: number;
  systemWeight: number;
  weightDiff: number;
  shownWeightDiff: number;
  weightAlert: boolean;
  weightOverridden: boolean;
  note: string;
  alert: boolean;
  stats: LineStats;
};

function cellValue(session: SessionDoc, lineId: string, key: string): number {
  const value = session.cells[lineId]?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function weightToleranceOf(line: CountLine): number {
  return line.weightTolerance ?? 0;
}

export function isOutside(diff: number, tolerance: number): boolean {
  return Math.abs(diff) > tolerance + 1e-9;
}

export function calcLine(
  line: CountLine,
  session: SessionDoc,
  rows: SystemRow[],
  assignment: Map<string, string>,
  qtyTolerance: number,
): LineCalc {
  const columns = positionColumns(line.category, line.section);
  const positions: Record<string, number> = {};
  for (const column of columns) positions[column.key] = cellValue(session, line.id, column.key);
  const stats = statsForLine(line, rows, assignment);
  const note = session.notes[line.id] ?? "";
  const weightMode = line.mode === "weight" || sectionIsWeight(line.category, line.section);

  if (line.countOnly) {
    const totalQty = cellValue(session, line.id, "so");
    const qtyDiff = round4(totalQty);
    const qtyAlert = isOutside(qtyDiff, qtyTolerance);
    return {
      line,
      positions: { so: totalQty },
      totalQty,
      systemQty: 0,
      qtyDiff,
      shownQtyDiff: qtyAlert ? qtyDiff : 0,
      qtyAlert,
      actualWeight: 0,
      systemWeight: 0,
      weightDiff: 0,
      shownWeightDiff: 0,
      weightAlert: false,
      weightOverridden: false,
      note,
      alert: qtyAlert,
      stats,
    };
  }

  if (weightMode) {
    const actualWeight = round4(Object.values(positions).reduce((sum, value) => sum + value, 0));
    const systemWeight = stats.rawWeight;
    const weightDiff = round4(actualWeight - systemWeight);
    const weightAlert = isOutside(weightDiff, weightToleranceOf(line));
    return {
      line,
      positions,
      totalQty: 0,
      systemQty: stats.sl,
      qtyDiff: 0,
      shownQtyDiff: 0,
      qtyAlert: false,
      actualWeight,
      systemWeight,
      weightDiff,
      shownWeightDiff: weightAlert ? weightDiff : 0,
      weightAlert,
      weightOverridden: false,
      note,
      alert: weightAlert,
      stats,
    };
  }

  const totalQty = round4(Object.values(positions).reduce((sum, value) => sum + value, 0));
  const systemQty = stats.sl;
  const qtyDiff = round4(totalQty - systemQty);
  const qtyAlert = isOutside(qtyDiff, qtyTolerance);
  const override = session.weightOverride[line.id];
  const weightOverridden = typeof override === "number" && Number.isFinite(override);
  const defaultWeight = line.unitWeight != null ? round4(totalQty * line.unitWeight) : 0;
  const actualWeight = weightOverridden ? round4(override) : defaultWeight;
  const systemWeight = stats.tl;
  const weightDiff = round4(actualWeight - systemWeight);
  const showWeight = templateOf(line.category).weightColumns || line.unitWeight != null;
  const weightAlert = showWeight && isOutside(weightDiff, weightToleranceOf(line));
  return {
    line,
    positions,
    totalQty,
    systemQty,
    qtyDiff,
    shownQtyDiff: qtyAlert ? qtyDiff : 0,
    qtyAlert,
    actualWeight,
    systemWeight,
    weightDiff,
    shownWeightDiff: weightAlert ? weightDiff : 0,
    weightAlert,
    weightOverridden,
    note,
    alert: qtyAlert || weightAlert,
    stats,
  };
}

export function calcSession(lines: CountLine[], session: SessionDoc, rows: SystemRow[], qtyTolerance: number) {
  const assignment = assignRows(rows, lines);
  const calcs = lines
    .filter((line) => line.category === session.category)
    .map((line) => calcLine(line, session, rows, assignment, qtyTolerance));
  return { assignment, calcs };
}
