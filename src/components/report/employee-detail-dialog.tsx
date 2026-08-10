"use client";

import type { EmployeeTargetDetail } from "@/lib/report/types";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatNumber, formatPctVi, formatVnd } from "@/lib/utils";

function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function TargetProgressBar({
  label,
  actual,
  target,
  pct,
  tone,
  formatValue,
}: {
  label: string;
  actual: number;
  target: number;
  pct: number | null;
  tone: "primary" | "coral";
  formatValue: (v: number) => string;
}) {
  const ratio = pct != null ? Math.min(pct, 1) : target > 0 ? Math.min(actual / target, 1) : 0;
  const displayPct = pct != null ? pct * 100 : target > 0 ? (actual / target) * 100 : 0;
  const good = displayPct >= 100;

  return (
    <div className="rounded-2xl border border-border/60 bg-lavender-soft/30 px-4 py-3">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatValue(actual)} /{" "}
            <strong className={tone === "primary" ? "text-primary" : "text-coral"}>
              {formatValue(target)}
            </strong>
          </p>
        </div>
        <p
          className={cn(
            "text-lg font-bold tabular-nums",
            good ? "text-success" : tone === "primary" ? "text-primary" : "text-coral",
          )}
        >
          {target > 0 ? formatPctVi(pct ?? actual / target) : "—"}
        </p>
      </div>
      <div className={cn("h-2.5 overflow-hidden rounded-full", tone === "primary" ? "bg-muted" : "bg-coral-soft")}>
        <div
          className={cn("h-full rounded-full transition-all", tone === "primary" ? "bg-primary" : "bg-coral")}
          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function EmployeeDetailDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: EmployeeTargetDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!detail) return null;

  const plan = detail.dtPlan > 0 || detail.slPlan > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{detail.name}</DialogTitle>
          <DialogDescription>
            {detail.code ? `${detail.code} · ` : ""}
            Tiến độ chỉ tiêu lũy kế đến {formatDateVi(detail.asOfDate)}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {!plan ? (
            <p className="rounded-2xl bg-lavender-soft px-4 py-3 text-sm text-muted-foreground">
              Không tìm thấy chỉ tiêu kế hoạch / sản lượng tính lương trong file target cho nhân
              viên này.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <TargetProgressBar
                  label="Doanh thu kế hoạch"
                  actual={detail.dtActual}
                  target={detail.dtPlan}
                  pct={detail.dtPct}
                  tone="primary"
                  formatValue={formatVnd}
                />
                <TargetProgressBar
                  label="Sản lượng tính lương"
                  actual={detail.slActual}
                  target={detail.slPlan}
                  pct={detail.slPct}
                  tone="coral"
                  formatValue={formatNumber}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Còn thiếu doanh thu</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-primary">
                    {detail.dtPlan > 0 ? formatVnd(detail.dtRemaining) : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Còn thiếu sản lượng</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-coral">
                    {detail.slPlan > 0 ? formatNumber(detail.slRemaining) : "—"}
                  </p>
                </div>
              </div>

              {detail.breakdown.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Theo ngành hàng</p>
                  <div className="overflow-auto rounded-xl border border-border/60">
                    <table className="w-full min-w-[520px] border-collapse text-xs">
                      <thead>
                        <tr className="bg-lavender-soft/50 text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Danh mục</th>
                          <th className="px-3 py-2 text-right font-medium">Doanh thu thực / Kế hoạch</th>
                          <th className="px-3 py-2 text-right font-medium">% Doanh thu</th>
                          <th className="px-3 py-2 text-right font-medium">Sản lượng thực / Kế hoạch</th>
                          <th className="px-3 py-2 text-right font-medium">% Sản lượng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.breakdown.map((row) => {
                          const dtPctRow = row.dtPlan > 0 ? row.dtActual / row.dtPlan : null;
                          const slPctRow = row.slPlan > 0 ? row.slActual / row.slPlan : null;
                          const weak =
                            (dtPctRow != null && dtPctRow < 0.7) ||
                            (slPctRow != null && slPctRow < 0.7);
                          const dtGood = dtPctRow != null && dtPctRow >= 1;
                          const slGood = slPctRow != null && slPctRow >= 1;
                          return (
                            <tr
                              key={row.label}
                              className={cn(
                                "border-t border-border/40",
                                weak && "bg-coral-soft/30",
                              )}
                            >
                              <td className="px-3 py-2 font-medium">{row.label}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                <span className="font-bold text-foreground">{formatVnd(row.dtActual)}</span>
                                <span className="text-muted-foreground"> / {formatVnd(row.dtPlan)}</span>
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-2 text-right font-bold tabular-nums",
                                  dtGood ? "text-success" : "text-primary",
                                )}
                              >
                                {dtPctRow != null ? formatPctVi(dtPctRow) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                <span className="font-bold text-foreground">{formatNumber(row.slActual)}</span>
                                <span className="text-muted-foreground"> / {formatNumber(row.slPlan)}</span>
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-2 text-right font-bold tabular-nums",
                                  slGood ? "text-success" : "text-coral",
                                )}
                              >
                                {slPctRow != null ? formatPctVi(slPctRow) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {detail.suggestions.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Gợi ý cải thiện</p>
              <ul className="space-y-2">
                {detail.suggestions.map((tip) => (
                  <li
                    key={tip}
                    className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm leading-relaxed text-muted-foreground"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
