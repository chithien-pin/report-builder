"use client";

import type { ComponentType, ReactNode } from "react";
import { Boxes, Percent, Receipt, TrendingUp, Wallet } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { OverviewOpsKpi } from "@/lib/report/types";
import { cn, formatMillionTr, formatNumber, formatPctVi, formatVnd } from "@/lib/utils";

function formatTyShort(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString("vi-VN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} tỷ`;
  }
  return formatMillionTr(value);
}

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  className,
  children,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone: "primary" | "coral" | "success" | "lavender";
  className?: string;
  children?: ReactNode;
}) {
  const toneCls = {
    primary: "bg-lavender-soft text-primary",
    coral: "bg-coral-soft text-coral",
    success: "bg-success/15 text-success",
    lavender: "bg-muted text-muted-foreground",
  }[tone];

  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card px-4 py-3.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", toneCls)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums tracking-tight md:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

export function OverviewOpsKpiCard({
  kpi,
  scopeLabel,
  visitorCount,
  onVisitorCountChange,
}: {
  kpi: OverviewOpsKpi;
  scopeLabel?: string;
  visitorCount: number;
  onVisitorCountChange: (count: number) => void;
}) {
  const cr = visitorCount > 0 ? kpi.orderCount / visitorCount : null;

  return (
    <div className="soft-card mb-5 overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-primary" />
          <h2 className="text-base font-bold">Chỉ số vận hành</h2>
          {scopeLabel && (
            <span className="rounded-full bg-lavender-soft px-2.5 py-0.5 text-xs font-medium text-primary">
              {scopeLabel}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Tổng hợp theo khoảng ngày đang lọc · CR cần nhập số khách ghé thăm
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          label="Tổng doanh thu"
          value={formatVnd(kpi.revenue)}
          hint={formatTyShort(kpi.revenue)}
          icon={Wallet}
          tone="primary"
        />
        <MetricTile
          label="Tổng hóa đơn"
          value={formatNumber(kpi.orderCount)}
          hint="Đơn hàng hợp lệ"
          icon={Receipt}
          tone="coral"
        />
        <MetricTile
          label="AOV (giá trị/đơn)"
          value={formatMillionTr(kpi.aov)}
          hint={`${formatVnd(kpi.aov)} / đơn`}
          icon={TrendingUp}
          tone="primary"
        />
        <MetricTile
          label="UPT (SP/hóa đơn)"
          value={formatNumber(kpi.upt)}
          hint={`Tổng ${formatNumber(kpi.itemCount)} món`}
          icon={Boxes}
          tone="success"
        />
        <MetricTile
          label="CR (tỷ lệ chuyển đổi)"
          value={cr != null ? formatPctVi(cr) : "—"}
          hint={
            visitorCount > 0
              ? `${formatNumber(kpi.orderCount)} / ${formatNumber(visitorCount)} khách`
              : "Nhập số khách ghé thăm"
          }
          icon={Percent}
          tone="lavender"
        >
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted/40 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Số đơn hàng</p>
              <p className="font-semibold tabular-nums">{formatNumber(kpi.orderCount)}</p>
            </div>
            <div className="rounded-xl bg-muted/40 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Khách ghé thăm</p>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                className="mt-0.5 h-7 border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                value={visitorCount || ""}
                placeholder="0"
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  onVisitorCountChange(raw ? Number(raw) : 0);
                }}
              />
            </div>
          </div>
        </MetricTile>
      </div>
    </div>
  );
}
