"use client";

import { useMemo, useState } from "react";
import { calcSession, type LineCalc } from "@/lib/check-stock/calc";
import { sheetColumns, type SheetColumn } from "@/lib/check-stock/csv";
import { foldKey, formatQty, round4 } from "@/lib/check-stock/format";
import { sectionsFor } from "@/lib/check-stock/templates";
import type { CountLine, SessionDoc, SystemRow } from "@/lib/check-stock/types";

type Patch = (recipe: (doc: SessionDoc) => SessionDoc) => void;

export function CountTable({
  lines,
  session,
  rows,
  qtyTolerance,
  onlyDiff,
  query,
  onPatch,
}: {
  lines: CountLine[];
  session: SessionDoc;
  rows: SystemRow[];
  qtyTolerance: number;
  onlyDiff: boolean;
  query: string;
  onPatch: Patch;
}) {
  const categoryLines = useMemo(
    () => lines.filter((line) => line.category === session.category),
    [lines, session.category],
  );
  const { calcs } = useMemo(
    () => calcSession(categoryLines, session, rows, qtyTolerance),
    [categoryLines, qtyTolerance, rows, session],
  );
  const byId = useMemo(() => new Map(calcs.map((calc) => [calc.line.id, calc])), [calcs]);
  const sections = sectionsFor(session.category, categoryLines.map((line) => line.section));
  const blocks: {
    id: string;
    title: string;
    columns: SheetColumn[];
    rows: { line: CountLine; row: number; calc: LineCalc }[];
    totals: LineCalc[];
  }[] = [];
  let navRow = 0;
  for (const section of sections) {
    const sectionLines = categoryLines
      .filter((line) => line.section === section.id)
      .sort((a, b) => a.order - b.order);
    if (sectionLines.length === 0) continue;
    const columns = sheetColumns(sectionLines, section.id);
    const visible = sectionLines.filter((line) => {
      const calc = byId.get(line.id);
      if (!calc) return false;
      if (onlyDiff && !calc.alert) return false;
      if (query.trim() && !foldKey(line.label).includes(foldKey(query))) return false;
      return true;
    });
    if (visible.length === 0) continue;
    const rowsForSection: { line: CountLine; row: number; calc: LineCalc }[] = [];
    for (const line of visible) {
      const calc = byId.get(line.id);
      if (!calc) continue;
      rowsForSection.push({ line, row: navRow, calc });
      navRow += 1;
    }
    const totals = sectionLines.map((line) => byId.get(line.id)).filter((calc): calc is LineCalc => Boolean(calc));
    blocks.push({ id: section.id, title: section.title, columns, rows: rowsForSection, totals });
  }

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <section key={block.id} className="soft-card overflow-x-auto">
          <h2 className="px-3 pt-3 font-medium">{block.title}</h2>
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="sticky left-0 bg-card px-3 py-2">Dòng</th>
                {block.columns.map((column) => (
                  <th key={columnHeaderKey(column)} className="px-2 py-2 text-right">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map(({ line, row, calc }) => (
                <tr key={line.id} className="border-t border-border">
                  <th className="sticky left-0 bg-card px-3 py-1 text-left font-medium">
                    <span className="block">{line.label}</span>
                    {line.verified ? null : <span className="text-[11px] font-normal text-coral">Chưa xác nhận</span>}
                    {line.countOnly ? (
                      <NumInput
                        nav={`${row}:so`}
                        decimal={false}
                        value={calc.totalQty}
                        onCommit={(value) => onPatch((doc) => setCell(doc, line.id, "so", value))}
                      />
                    ) : null}
                  </th>
                  {block.columns.map((column, colIndex) => (
                    <td key={columnHeaderKey(column)} className={cellClass(calc, column)}>
                      {renderCell(calc, column, row, colIndex, onPatch)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/50 font-medium">
                <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left">Tổng</th>
                {block.columns.map((column) => (
                  <td key={columnHeaderKey(column)} className="px-2 py-2 text-right">
                    {column.kind === "note" ? "" : formatQty(columnTotal(block.totals, column))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function columnHeaderKey(column: SheetColumn): string {
  return column.kind === "pos" ? column.key : column.kind;
}

function cellClass(calc: LineCalc, column: SheetColumn): string {
  const alert = (column.kind === "qtyDiff" && calc.qtyAlert) || (column.kind === "weightDiff" && calc.weightAlert);
  return `px-2 py-1 text-right ${alert ? "bg-coral-soft" : ""}`;
}

function renderCell(calc: LineCalc, column: SheetColumn, row: number, col: number, onPatch: Patch) {
  if (calc.line.countOnly) {
    if (column.kind === "note") return <NoteInput row={row} col={col} value={calc.note} onCommit={(note) => onPatch((doc) => setNote(doc, calc.line.id, note))} />;
    return "—";
  }
  if (column.kind === "pos") {
    const decimal = calc.line.mode === "weight";
    return (
      <NumInput
        nav={`${row}:${col}`}
        decimal={decimal}
        value={calc.positions[column.key] ?? 0}
        onCommit={(value) => onPatch((doc) => setCell(doc, calc.line.id, column.key, value))}
      />
    );
  }
  if (column.kind === "note") {
    return <NoteInput row={row} col={col} value={calc.note} onCommit={(note) => onPatch((doc) => setNote(doc, calc.line.id, note))} />;
  }
  if (column.kind === "qtyDiff" && calc.line.mode === "weight") return "—";
  if (column.kind === "actualWeight" && calc.line.mode !== "weight") {
    return (
      <span className="inline-flex items-center justify-end gap-1">
        <NumInput
          nav={`${row}:${col}`}
          decimal
          value={calc.actualWeight}
          onCommit={(value) => onPatch((doc) => ({ ...doc, weightOverride: { ...doc.weightOverride, [calc.line.id]: value } }))}
        />
        {calc.weightOverridden ? (
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline"
            onClick={() =>
              onPatch((doc) => {
                const weightOverride = { ...doc.weightOverride };
                delete weightOverride[calc.line.id];
                return { ...doc, weightOverride };
              })
            }
          >
            Mặc định
          </button>
        ) : null}
      </span>
    );
  }
  const value = shown(calc, column.kind);
  return formatQty(value);
}

function shown(calc: LineCalc, kind: Exclude<SheetColumn["kind"], "pos" | "note">): number {
  if (kind === "totalQty") return calc.totalQty;
  if (kind === "systemQty") return calc.systemQty;
  if (kind === "qtyDiff") return calc.shownQtyDiff;
  if (kind === "actualWeight") return calc.actualWeight;
  if (kind === "systemWeight") return calc.systemWeight;
  return calc.shownWeightDiff;
}

function columnTotal(calcs: LineCalc[], column: SheetColumn): number {
  if (column.kind === "note") return 0;
  return round4(calcs.reduce((sum, calc) => {
    if (calc.line.countOnly) return sum;
    if (column.kind === "pos") return sum + (calc.positions[column.key] ?? 0);
    if (column.kind === "qtyDiff" && calc.line.mode === "weight") return sum;
    return sum + shown(calc, column.kind);
  }, 0));
}

function setCell(doc: SessionDoc, lineId: string, key: string, value: number): SessionDoc {
  const current = { ...(doc.cells[lineId] ?? {}) };
  if (!value) delete current[key];
  else current[key] = value;
  const cells = { ...doc.cells };
  if (Object.keys(current).length === 0) delete cells[lineId];
  else cells[lineId] = current;
  return { ...doc, cells };
}

function setNote(doc: SessionDoc, lineId: string, note: string): SessionDoc {
  const notes = { ...doc.notes };
  if (note) notes[lineId] = note;
  else delete notes[lineId];
  return { ...doc, notes };
}

function onNav(event: React.KeyboardEvent<HTMLInputElement>) {
  const key = event.key;
  if (key !== "Enter" && key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") return;
  const input = event.currentTarget;
  const nav = input.dataset.nav;
  if (!nav) return;
  const [rowText, colText] = nav.split(":");
  const row = Number(rowText);
  const col = Number(colText);
  if (key === "ArrowLeft" && input.selectionStart !== 0) return;
  if (key === "ArrowRight" && input.selectionStart !== input.value.length) return;
  const nextRow = key === "Enter" || key === "ArrowDown" ? row + 1 : key === "ArrowUp" ? row - 1 : row;
  const nextCol = key === "ArrowLeft" ? col - 1 : key === "ArrowRight" ? col + 1 : col;
  const target = document.querySelector<HTMLInputElement>(`[data-nav="${nextRow}:${nextCol}"]`);
  if (!target) return;
  event.preventDefault();
  target.focus();
  target.select();
}

function sanitize(raw: string, decimal: boolean): string {
  if (!decimal) return raw.replace(/[^\d]/g, "");
  const cleaned = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const [head, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${head}.${rest.join("")}` : head;
}

function NumInput({
  value,
  decimal,
  nav,
  onCommit,
}: {
  value: number;
  decimal: boolean;
  nav: string;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value ? String(value) : "");
  return (
    <input
      data-nav={nav}
      inputMode={decimal ? "decimal" : "numeric"}
      className="h-8 w-20 rounded-md bg-muted px-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/30"
      value={shown}
      onFocus={() => setText(value ? String(value) : "")}
      onBlur={() => setText(null)}
      onChange={(event) => {
        const next = sanitize(event.target.value, decimal);
        setText(next);
        if (next === "" || next === "." || next.endsWith(".")) {
          if (next === "") onCommit(0);
          return;
        }
        const parsed = Number(next);
        if (Number.isFinite(parsed)) onCommit(parsed);
      }}
      onKeyDown={onNav}
    />
  );
}

function NoteInput({
  value,
  row,
  col,
  onCommit,
}: {
  value: string;
  row: number;
  col: number;
  onCommit: (value: string) => void;
}) {
  return (
    <input
      data-nav={`${row}:${col}`}
      className="h-8 w-36 rounded-md bg-muted px-2 text-left text-sm outline-none focus:ring-2 focus:ring-primary/30"
      value={value}
      onChange={(event) => onCommit(event.target.value)}
      onKeyDown={onNav}
    />
  );
}
