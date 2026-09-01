"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { DailyCompactRow } from "@/lib/report/types";
import { cn, formatNumber } from "@/lib/utils";

function formatPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function AllDaysTable({
  series,
  selectedDate,
  onSelectDate,
}: {
  series: DailyCompactRow[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="soft-card mb-5 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-border/60 px-5 py-4 text-left transition-colors hover:bg-lavender-soft/40"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="h-5 w-1 shrink-0 rounded-full bg-primary" />
        <h2 className="text-base font-bold">Tất cả ngày</h2>
        <span className="rounded-full bg-lavender-soft px-2.5 py-0.5 text-xs font-medium text-primary">
          {series.length} ngày
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="overflow-auto">
          <table className="min-w-[720px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3.5 font-medium">Ngày</th>
                <th className="px-3 py-3.5 text-right font-medium">SL thực tế</th>
                <th className="px-3 py-3.5 text-right font-medium">SL chỉ tiêu</th>
                <th className="px-3 py-3.5 text-right font-medium">% SL</th>
                <th className="px-3 py-3.5 text-right font-medium">DT thực tế</th>
                <th className="px-3 py-3.5 text-right font-medium">DT chỉ tiêu</th>
                <th className="px-3 py-3.5 text-right font-medium">% DT</th>
              </tr>
            </thead>
            <tbody>
              {series.map((row) => {
                const active = row.date === selectedDate;
                const slGood = row.slPct != null && row.slPct >= 1;
                const dtGood = row.dtPct != null && row.dtPct >= 1;
                return (
                  <tr
                    key={row.date}
                    className={cn(
                      "cursor-pointer border-b border-border/60 transition-colors hover:bg-lavender-soft/50",
                      active && "bg-lavender-soft",
                    )}
                    onClick={() => onSelectDate(row.date)}
                  >
                    <td className="px-4 py-3 font-medium">{formatDateVi(row.date)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(row.slActual)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {formatNumber(row.slTarget)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right tabular-nums",
                        slGood
                          ? "text-success"
                          : row.slPct != null && row.slPct < 0.8 && "text-coral",
                      )}
                    >
                      {formatPct(row.slPct)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(row.dtActual)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {formatNumber(row.dtTarget)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right tabular-nums",
                        dtGood
                          ? "text-success"
                          : row.dtPct != null && row.dtPct < 0.8 && "text-coral",
                      )}
                    >
                      {formatPct(row.dtPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
