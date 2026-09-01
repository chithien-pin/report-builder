"use client";

import type { EmployeeTargetBreakdownRow } from "@/lib/report/types";
import { cn, formatNumber, formatPctVi, formatVnd } from "@/lib/utils";

function isTrangSucKhacCategory(label: string): boolean {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("trang suc khac");
}

export function StoreCategoryTargetCard({
  rows,
  scopeLabel,
  asOfDate,
}: {
  rows: EmployeeTargetBreakdownRow[];
  scopeLabel?: string;
  asOfDate?: string;
}) {
  if (rows.length === 0) return null;

  function formatDateVi(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  return (
    <div className="soft-card mb-5 overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-primary" />
          <h2 className="text-base font-bold">Theo ngành hàng</h2>
          {scopeLabel && (
            <span className="rounded-full bg-lavender-soft px-2.5 py-0.5 text-xs font-medium text-primary">
              {scopeLabel}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Tiến độ chỉ tiêu toàn cửa hàng
          {asOfDate ? ` · lũy kế đến ${formatDateVi(asOfDate)}` : ""}
        </p>
      </div>

      <div className="overflow-auto px-2 pb-2 pt-2">
        <div className="overflow-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-lavender-soft/50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Danh mục</th>
                <th className="px-3 py-2.5 text-right font-medium">Doanh thu thực / Kế hoạch</th>
                <th className="px-3 py-2.5 text-right font-medium">% Doanh thu</th>
                <th className="px-3 py-2.5 text-right font-medium">Sản lượng thực / Kế hoạch</th>
                <th className="px-3 py-2.5 text-right font-medium">% Sản lượng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const hideSl = isTrangSucKhacCategory(row.label);
                const dtPctRow = row.dtPlan > 0 ? row.dtActual / row.dtPlan : null;
                const slPctRow =
                  !hideSl && row.slPlan > 0 ? row.slActual / row.slPlan : null;
                const weak =
                  (dtPctRow != null && dtPctRow < 0.7) ||
                  (slPctRow != null && slPctRow < 0.7);
                const dtGood = dtPctRow != null && dtPctRow >= 1;
                const slGood = slPctRow != null && slPctRow >= 1;
                return (
                  <tr
                    key={row.label}
                    className={cn("border-t border-border/40", weak && "bg-coral-soft/30")}
                  >
                    <td className="px-3 py-2.5 font-medium">{row.label}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="font-bold text-foreground">{formatVnd(row.dtActual)}</span>
                      <span className="text-muted-foreground"> / {formatVnd(row.dtPlan)}</span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-bold tabular-nums",
                        dtGood ? "text-success" : "text-primary",
                      )}
                    >
                      {dtPctRow != null ? formatPctVi(dtPctRow) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {hideSl ? (
                        "—"
                      ) : (
                        <>
                          <span className="font-bold text-foreground">
                            {formatNumber(row.slActual)}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            / {formatNumber(row.slPlan)}
                          </span>
                        </>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-bold tabular-nums",
                        hideSl
                          ? "text-muted-foreground"
                          : slGood
                            ? "text-success"
                            : "text-coral",
                      )}
                    >
                      {hideSl ? "—" : slPctRow != null ? formatPctVi(slPctRow) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
