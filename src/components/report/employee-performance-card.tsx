"use client";

import { useState } from "react";
import { ChevronRight, Medal } from "lucide-react";

import { EmployeeDetailDialog } from "@/components/report/employee-detail-dialog";
import type { EmployeeInsight, EmployeePerformance, EmployeeTargetDetail } from "@/lib/report/types";
import { getEmployeeTargetDetail } from "@/lib/report/employee-targets";
import {
  cn,
  formatMillionTrShort,
  formatNumber,
  formatPctVi,
  formatRatioX,
} from "@/lib/utils";

function InsightCard({ insight }: { insight: EmployeeInsight }) {
  const isMedal = insight.medal != null;
  const isWarning = insight.kind === "needs-support";

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        isMedal
          ? "border-primary/30 bg-lavender-soft/60"
          : "border-border bg-muted/40",
      )}
    >
      <div className="flex items-start gap-2">
        {insight.medal === "gold" && (
          <Medal className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        )}
        {insight.medal === "silver" && (
          <Medal className="mt-0.5 h-4 w-4 shrink-0 text-lavender" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{insight.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tỷ số DT:{" "}
            <span className="font-medium text-foreground">{formatRatioX(insight.revenueRatio)}</span>
            {" · "}
            Tỷ số đơn:{" "}
            <span className="font-medium text-foreground">{formatRatioX(insight.orderRatio)}</span>
            {insight.marginPct != null && (
              <>
                {" · "}
                Margin:{" "}
                <span className="font-medium text-primary">{formatPctVi(insight.marginPct)}</span>
              </>
            )}
            {insight.aov != null && (
              <>
                {" · "}
                AOV:{" "}
                <span className={cn("font-medium", isWarning && "text-destructive")}>
                  {formatMillionTrShort(insight.aov)}
                </span>
              </>
            )}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{insight.caption}</p>
        </div>
      </div>
    </div>
  );
}

function TargetPctBadge({ detail }: { detail: EmployeeTargetDetail | null }) {
  if (!detail || (detail.dtPlan <= 0 && detail.slPlan <= 0)) {
    return <span className="text-muted-foreground">—</span>;
  }
  const dtPct = detail.dtPct;
  const good = dtPct != null && dtPct >= 1;
  const low = dtPct != null && dtPct < 0.8;
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        good ? "text-success" : low ? "text-coral" : "text-primary",
      )}
    >
      {dtPct != null ? formatPctVi(dtPct) : "—"}
    </span>
  );
}

export function EmployeePerformanceCard({
  data,
  scopeLabel,
}: {
  data: EmployeePerformance;
  scopeLabel?: string;
}) {
  const [selected, setSelected] = useState<EmployeeTargetDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const topMargin = Math.max(...data.employees.map((e) => e.marginPct), 0);

  function openDetail(name: string) {
    const detail = getEmployeeTargetDetail(data.targetDetails, name);
    if (!detail) return;
    setSelected(detail);
    setDialogOpen(true);
  }

  return (
    <>
      <div className="soft-card mb-5 overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary" />
            <h2 className="text-base font-bold">Hiệu suất nhân viên</h2>
            {scopeLabel && (
              <span className="rounded-full bg-lavender-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                {scopeLabel}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Bấm vào nhân viên để xem chi tiết chỉ tiêu DT kế hoạch & SL tính lương
          </p>
        </div>

        <div className="overflow-auto px-2 pt-2">
          <table className="min-w-[960px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-lavender-soft text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Nhân viên</th>
                <th className="px-3 py-2.5 text-right font-medium">Doanh thu</th>
                <th className="px-3 py-2.5 text-right font-medium">% DT</th>
                <th className="px-3 py-2.5 text-right font-medium">% CT tháng</th>
                <th className="px-3 py-2.5 text-right font-medium">Số đơn</th>
                <th className="px-3 py-2.5 text-right font-medium">% Đơn</th>
                <th className="px-3 py-2.5 text-right font-medium">AOV</th>
                <th className="px-3 py-2.5 text-right font-medium">SP/đơn</th>
                <th className="px-3 py-2.5 text-right font-medium">LN gộp</th>
                <th className="px-3 py-2.5 text-right font-medium">Margin</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {data.employees.map((row, idx) => {
                const emphasize = idx < 3;
                const isTopMargin = row.marginPct === topMargin && topMargin > 0;
                const isLowAov =
                  row.aov === Math.min(...data.employees.map((e) => e.aov)) &&
                  data.employees.length > 1;
                const targetDetail = getEmployeeTargetDetail(data.targetDetails, row.name);
                const hasDetail = targetDetail != null;

                return (
                  <tr
                    key={row.name}
                    className={cn(
                      "border-b border-border/40 transition-colors",
                      idx % 2 === 1 && "bg-lavender-soft/30",
                      hasDetail && "cursor-pointer hover:bg-lavender-soft/50",
                    )}
                    onClick={() => hasDetail && openDetail(row.name)}
                  >
                    <td className={cn("px-3 py-2.5", emphasize && "font-bold")}>{row.name}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                      {formatMillionTrShort(row.revenue)}
                    </td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                      {formatPctVi(row.revenueSharePct)}
                    </td>
                    <td className={cn("px-3 py-2.5 text-right", emphasize && "font-bold")}>
                      <TargetPctBadge detail={targetDetail} />
                    </td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                      {row.orderCount}
                    </td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                      {formatPctVi(row.orderSharePct)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums",
                        emphasize && "font-bold",
                        isLowAov && "text-destructive",
                      )}
                    >
                      {formatMillionTrShort(row.aov)}
                    </td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                      {formatNumber(row.itemsPerOrder)}
                    </td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                      {formatMillionTrShort(row.grossProfit)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums",
                        emphasize && "font-bold",
                        isTopMargin && "font-semibold text-primary",
                      )}
                    >
                      {formatPctVi(row.marginPct)}
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground">
                      {hasDetail && <ChevronRight className="h-4 w-4" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.insights.length > 0 && (
          <div className="border-t border-border/60 px-5 py-4">
            <p className="mb-3 text-sm font-semibold">Tỷ số bán hàng (so với trung bình nhóm)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.insights.map((insight) => (
                <InsightCard key={`${insight.kind}-${insight.name}`} insight={insight} />
              ))}
            </div>
          </div>
        )}
      </div>

      <EmployeeDetailDialog
        detail={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
