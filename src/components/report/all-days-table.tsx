"use client";

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
  return (
    <div className="soft-card overflow-auto">
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
  );
}
