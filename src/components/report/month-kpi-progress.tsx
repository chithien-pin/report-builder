"use client";

import type { MonthKpiSummary } from "@/lib/report/types";
import { cn, formatNumber } from "@/lib/utils";

function formatPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

function ProgressBar({
  label,
  actual,
  target,
  pct,
  tone,
}: {
  label: string;
  actual: number;
  target: number;
  pct: number | null;
  tone: "primary" | "coral";
}) {
  const fullPct = pct ?? (target > 0 ? actual / target : null);
  const ratio = fullPct != null ? Math.min(fullPct, 1) : 0;
  const displayPct = fullPct != null ? fullPct * 100 : 0;
  const good = displayPct >= 100;
  const barCls = tone === "primary" ? "bg-primary" : "bg-coral";
  const trackCls = tone === "primary" ? "bg-lavender-soft" : "bg-coral-soft";

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatNumber(actual)} /{" "}
            <strong className={tone === "primary" ? "text-primary" : "text-coral"}>
              {formatNumber(target)}
            </strong>
          </p>
        </div>
        <p
          className={cn(
            "text-lg font-bold tabular-nums",
            good ? "text-success" : tone === "primary" ? "text-primary" : "text-coral",
          )}
        >
          {formatPct(fullPct)}
        </p>
      </div>
      <div className={cn("h-3 overflow-hidden rounded-full", trackCls)}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", barCls)}
          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function CombinedMilestoneBar({ kpi }: { kpi: MonthKpiSummary }) {
  if (kpi.dtTarget <= 0) return null;

  const milestone = 0.7;
  const milestoneTarget = kpi.dtTarget * milestone;
  const progressToMilestone = kpi.dtActual / milestoneTarget;
  const reached = progressToMilestone >= 1;
  const barWidth = Math.min(progressToMilestone * 100, 100);

  return (
    <div className="mt-5 border-t border-border/60 pt-5">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Tiến độ đạt mốc 70% chỉ tiêu doanh thu</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatNumber(kpi.dtActual)} /{" "}
            <strong className="text-primary">{formatNumber(milestoneTarget)}</strong>
            <span className="ml-1 text-muted-foreground/80">
              (70% của <strong className="text-primary">{formatNumber(kpi.dtTarget)}</strong>)
            </span>
          </p>
        </div>
        <p className={cn("text-lg font-bold tabular-nums", reached ? "text-success" : "text-primary")}>
          {formatPct(progressToMilestone)}
        </p>
      </div>
      <div className="h-3.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            reached ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {reached
          ? "Đã đạt mốc 70% chỉ tiêu doanh thu tháng"
          : (
            <>
              Còn{" "}
              <strong className="text-primary">
                {formatNumber(Math.max(0, milestoneTarget - kpi.dtActual))}
              </strong>{" "}
              để đạt mốc 70% ({formatPct(Math.max(0, 1 - progressToMilestone))})
            </>
          )}
      </p>
    </div>
  );
}

function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function MonthKpiProgress({ kpi }: { kpi: MonthKpiSummary }) {
  return (
    <div className="soft-card mb-5 px-5 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">KPI cả tháng</p>
          <p className="text-xs text-muted-foreground">
            Lũy kế đến {formatDateVi(kpi.asOfDate)}
          </p>
        </div>
        <span className="rounded-full bg-lavender-soft px-3 py-1 text-xs font-medium text-primary">
          TỔNG
        </span>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <ProgressBar
          label="Doanh thu"
          actual={kpi.dtActual}
          target={kpi.dtTarget}
          pct={kpi.dtPct}
          tone="primary"
        />
        <ProgressBar
          label="Sản lượng"
          actual={kpi.slActual}
          target={kpi.slTarget}
          pct={kpi.slPct}
          tone="coral"
        />
      </div>
      <CombinedMilestoneBar kpi={kpi} />
    </div>
  );
}
