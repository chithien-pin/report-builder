"use client";

import type { CategoryBreakdown } from "@/lib/report/types";
import { cn, formatMillionTr, formatNumber, formatPctVi, formatVnd } from "@/lib/utils";

function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function CumulativePctCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const good = value >= 1;
  const low = value < 0.8;
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        good ? "text-success" : low ? "text-coral" : "text-primary",
      )}
    >
      {formatPctVi(value)}
    </span>
  );
}

export function CategoryBreakdownCard({
  data,
  scopeLabel,
}: {
  data: CategoryBreakdown;
  scopeLabel?: string;
}) {
  const barRows = data.categories.filter((r) => r.sharePct >= 0.005);

  return (
    <div className="soft-card mb-5 overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-primary" />
          <h2 className="text-base font-bold">Doanh thu & Cơ cấu ngành hàng</h2>
          {scopeLabel && (
            <span className="rounded-full bg-lavender-soft px-2.5 py-0.5 text-xs font-medium text-primary">
              {scopeLabel}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Tổng thành tiền: <span className="font-medium text-foreground">{formatVnd(data.grossTotal)}</span>
          {" · "}
          Doanh thu thuần: <span className="font-medium text-foreground">{formatVnd(data.netRevenue)}</span>
          {data.variancePct != null && (
            <>
              {" · "}
              Chênh lệch: <span className="font-medium text-foreground">{formatPctVi(data.variancePct)}</span>
            </>
          )}
          {" · "}
          Tổng trọng lượng vàng bán:{" "}
          <span className="font-medium text-foreground">{formatNumber(data.goldWeightTotal)} chỉ</span>
        </p>
        {data.monthTarget > 0 && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            Lũy kế đến {formatDateVi(data.asOfDate)}:{" "}
            <span className="font-medium text-foreground">{formatVnd(data.cumulativeRevenue)}</span>
            {" / "}
            <span className="font-medium text-primary">CT tháng {formatVnd(data.monthTarget)}</span>
            {" · "}
            <span className="font-medium text-foreground">% đạt chỉ tiêu:</span>{" "}
            <CumulativePctCell value={data.cumulativePct} />
          </p>
        )}
        {data.slMonthTarget > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Sản lượng lũy kế:{" "}
            <span className="font-medium text-foreground">
              {formatNumber(data.cumulativeGoldWeight)} chỉ
            </span>
            {" / "}
            <span className="font-medium text-coral">CT {formatNumber(data.slMonthTarget)} chỉ</span>
            {" · "}
            <CumulativePctCell value={data.cumulativeSlPct} />
          </p>
        )}
      </div>

      <div className="px-5 py-4">
        <p className="mb-3 text-sm font-semibold">Cơ cấu theo danh mục sản phẩm</p>
        <div className="space-y-2.5">
          {barRows.map((row) => (
            <div
              key={row.category}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_3.5rem] items-center gap-3 text-sm"
            >
              <span className="truncate">{row.category}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(row.sharePct * 100, 100)}%` }}
                />
              </div>
              <span className="text-right tabular-nums text-muted-foreground">
                {formatPctVi(row.sharePct)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-auto px-2 pb-2">
        <table className="min-w-[960px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-lavender-soft text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Danh mục</th>
              <th className="px-3 py-2.5 text-right font-medium">Doanh thu</th>
              <th className="px-3 py-2.5 text-right font-medium">Tỷ trọng</th>
              <th className="px-3 py-2.5 text-right font-medium">% Lũy kế CT</th>
              <th className="px-3 py-2.5 text-right font-medium">Sản lượng</th>
              <th className="px-3 py-2.5 text-right font-medium">SL thực / KH</th>
              <th className="px-3 py-2.5 text-right font-medium">% Lũy kế SL</th>
              <th className="px-3 py-2.5 text-right font-medium">Số đơn</th>
              <th className="px-3 py-2.5 text-right font-medium">LN gộp</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((row, idx) => {
              const emphasize = idx < 3;
              const negative = row.grossProfit < 0;
              const slActual = row.slUnit === "chi" ? row.goldWeight : row.quantity;
              const slSuffix = row.slUnit === "chi" ? " chỉ" : "";
              return (
                <tr
                  key={row.category}
                  className={cn("border-b border-border/40", idx % 2 === 1 && "bg-lavender-soft/40")}
                >
                  <td className={cn("px-3 py-2.5", emphasize && "font-bold")}>{row.category}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                    {formatVnd(row.revenue)}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                    {formatPctVi(row.sharePct)}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right", emphasize && "font-bold")}>
                    <CumulativePctCell value={row.cumulativePct} />
                  </td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                    {row.hideSl ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      `${formatNumber(slActual)}${slSuffix}`
                    )}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                    {row.hideSl ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        <span className="font-bold">{formatNumber(row.cumulativeSl)}</span>
                        {row.slMonthTarget > 0 && (
                          <span className="text-muted-foreground">
                            {" / "}
                            {formatNumber(row.slMonthTarget)}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right", emphasize && "font-bold")}>
                    {row.hideSl ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <CumulativePctCell value={row.cumulativeSlPct} />
                    )}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold")}>
                    {row.orderCount}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right tabular-nums",
                      emphasize && "font-bold",
                      negative && "text-destructive",
                    )}
                  >
                    {formatMillionTr(row.grossProfit)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
