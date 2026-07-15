"use client";

import type { DayReport, GroupDayMetrics, MetricActual } from "@/lib/report/types";
import { cn, formatNumber } from "@/lib/utils";

function formatPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

function PctCell({ value }: { value: number | null }) {
  const good = value != null && value >= 1;
  const bad = value != null && value < 0.8;
  return (
    <td
      className={cn(
        "px-3 py-2.5 text-right tabular-nums",
        good && "font-semibold text-success",
        bad && "font-semibold text-coral",
      )}
    >
      {formatPct(value)}
    </td>
  );
}

function MetricRows({
  group,
  isTotal,
}: {
  group: GroupDayMetrics;
  isTotal?: boolean;
}) {
  const rowClass = isTotal ? "bg-lavender-soft/70 font-semibold" : "bg-transparent";

  const renderMetric = (label: string, m: MetricActual, showName: boolean) => (
    <tr key={`${group.groupId}-${label}`} className={cn("border-b border-border/60", rowClass)}>
      <td className="px-4 py-2.5 align-top text-sm">{showName ? group.groupName : ""}</td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground">{label}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(m.actual)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
        {formatNumber(m.target)}
      </td>
      <PctCell value={m.pct} />
      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(m.cumulativeActual)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
        {formatNumber(m.cumulativeTarget)}
      </td>
      <PctCell value={m.cumulativePct} />
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
        {formatNumber(m.monthTarget)}
      </td>
      <PctCell value={m.monthPct} />
    </tr>
  );

  return (
    <>
      {renderMetric("Sản lượng", group.sl, true)}
      {renderMetric("Doanh thu", group.dt, false)}
    </>
  );
}

export function DayDetailTable({ report }: { report: DayReport }) {
  return (
    <div className="soft-card overflow-auto">
      <table className="min-w-[960px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3.5 font-medium">Nhóm</th>
            <th className="px-3 py-3.5 font-medium">Tiêu chí</th>
            <th className="px-3 py-3.5 text-right font-medium">Thực tế ngày</th>
            <th className="px-3 py-3.5 text-right font-medium">Chỉ tiêu ngày</th>
            <th className="px-3 py-3.5 text-right font-medium">% Ngày</th>
            <th className="px-3 py-3.5 text-right font-medium">TT lũy kế</th>
            <th className="px-3 py-3.5 text-right font-medium">CT lũy kế</th>
            <th className="px-3 py-3.5 text-right font-medium">% Lũy kế</th>
            <th className="px-3 py-3.5 text-right font-medium">CT tháng</th>
            <th className="px-3 py-3.5 text-right font-medium">% Tháng</th>
          </tr>
        </thead>
        <tbody>
          <MetricRows group={report.total} isTotal />
          {report.groups.map((g) => (
            <MetricRows key={g.groupId} group={g} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
