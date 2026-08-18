"use client";

import type { CommissionForecast, CommissionPersonRow } from "@/lib/report/types";
import { cn, formatNumber, formatPctVi, formatVnd } from "@/lib/utils";

function formatDateVi(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatActual(row: { actual: number; unit: "chi" | "vnd" }): string {
  return row.unit === "vnd" ? formatVnd(row.actual) : formatNumber(row.actual);
}

function PersonBlock({
  title,
  row,
  emptyHint,
}: {
  title: string;
  row: CommissionPersonRow | null;
  emptyHint: string;
}) {
  if (!row) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-lavender-soft/20 px-4 py-3">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="font-semibold">{row.name}</p>
        </div>
        <p className={cn("text-lg font-bold tabular-nums", row.eligible ? "text-primary" : "text-muted-foreground")}>
          {formatVnd(row.total)}
        </p>
      </div>
      {row.groups.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full min-w-[420px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-medium">Nhóm</th>
                <th className="py-1 text-right font-medium">Thực / KH</th>
                <th className="py-1 text-right font-medium">%</th>
                <th className="py-1 text-right font-medium">Hoa hồng</th>
              </tr>
            </thead>
            <tbody>
              {row.groups.map((g) => (
                <tr key={g.key} className="border-t border-border/40">
                  <td className="py-1.5 font-medium">{g.label}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    <span className="font-bold">{formatActual(g)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      / {g.unit === "vnd" ? formatVnd(g.plan) : formatNumber(g.plan)}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "py-1.5 text-right font-bold tabular-nums",
                      g.eligible ? "text-success" : "text-coral",
                    )}
                  >
                    {formatPctVi(g.pct)}
                  </td>
                  <td className="py-1.5 text-right font-bold tabular-nums">{formatVnd(g.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{row.note}</p>
    </div>
  );
}

export function CommissionForecastCard({
  data,
  onOpenConfig,
}: {
  data: CommissionForecast;
  onOpenConfig?: () => void;
}) {
  return (
    <div className="soft-card mb-5 overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-primary" />
          <h2 className="text-base font-bold">Hoa hồng dự kiến</h2>
          {data.asOfDate && (
            <span className="rounded-full bg-lavender-soft px-2.5 py-0.5 text-xs font-medium text-primary">
              Lũy kế đến {formatDateVi(data.asOfDate)}
            </span>
          )}
          <p className="ml-auto text-sm font-bold tabular-nums text-primary">
            Tổng {formatVnd(data.grandTotal)}
          </p>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Ước tính theo chính sách T3.2026: đủ 70% từng nhóm mới hưởng; phần vượt kế hoạch hệ số 1.2.
          {onOpenConfig && (
            <>
              {" "}
              <button type="button" className="font-medium text-primary underline" onClick={onOpenConfig}>
                Chỉnh cấu hình
              </button>
            </>
          )}
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="mb-2 text-sm font-semibold">Tư vấn viên</p>
          {data.tvv.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu nhân viên trong tháng kế hoạch.</p>
          ) : (
            <div className="overflow-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="bg-lavender-soft/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Nhân viên</th>
                    <th className="px-3 py-2.5 text-right font-medium">Cấp</th>
                    <th className="px-3 py-2.5 text-right font-medium">Tích trữ</th>
                    <th className="px-3 py-2.5 text-right font-medium">TS 24k</th>
                    <th className="px-3 py-2.5 text-right font-medium">TS Khác</th>
                    <th className="px-3 py-2.5 text-right font-medium">Tổng HH</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tvv.map((row) => {
                    const byKey = Object.fromEntries(row.groups.map((g) => [g.key, g]));
                    return (
                      <tr key={row.name} className="border-t border-border/40">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{row.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{row.note}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{row.level}</td>
                        {(["tich-tru", "ts24k", "ts-khac"] as const).map((key) => (
                          <td key={key} className="px-3 py-2.5 text-right tabular-nums">
                            <span className="font-bold">{formatVnd(byKey[key]?.amount ?? 0)}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {formatPctVi(byKey[key]?.pct ?? null)}
                            </span>
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-primary">
                          {formatVnd(row.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PersonBlock
            title="Cửa hàng trưởng"
            row={data.cht}
            emptyHint="Chưa nhập tên CHT — mở cấu hình Hoa hồng để bổ sung."
          />
          <PersonBlock
            title="Thu ngân"
            row={data.cashier}
            emptyHint="Chưa nhập tên thu ngân — mở cấu hình Hoa hồng để bổ sung."
          />
        </div>
      </div>
    </div>
  );
}
