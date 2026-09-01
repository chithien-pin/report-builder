"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { CustomProductGroup, SkuSalesLine } from "@/lib/report/types";
import {
  buildCustomGroupDayDetails,
  buildCustomGroupEmployeeSummaries,
} from "@/lib/report/custom-product-groups";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatNumber, formatVnd } from "@/lib/utils";

function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function EmployeeProductDays({
  group,
  employeeName,
  lines,
}: {
  group: CustomProductGroup;
  employeeName: string;
  lines: SkuSalesLine[];
}) {
  const days = useMemo(
    () => buildCustomGroupDayDetails(group, lines, employeeName),
    [employeeName, group, lines],
  );

  if (days.length === 0) {
    return <p className="text-xs text-muted-foreground">Không có dòng bán.</p>;
  }

  return (
    <div className="space-y-3">
      {days.map((day) => (
        <div key={day.date} className="overflow-hidden rounded-lg border border-border/50 bg-card">
          <div className="flex flex-wrap items-center gap-2 bg-muted/30 px-3 py-1.5">
            <p className="text-xs font-semibold">{formatDateVi(day.date)}</p>
            <span className="text-[11px] text-muted-foreground">
              SL {formatNumber(day.quantityTotal)} · DT {formatVnd(day.revenueTotal)}
            </span>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[440px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-1.5 font-medium">STT</th>
                  <th className="px-3 py-1.5 font-medium">Tên sản phẩm</th>
                  <th className="px-3 py-1.5 text-right font-medium">Số lượng</th>
                  <th className="px-3 py-1.5 text-right font-medium">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {day.products.map((p) => (
                  <tr key={p.productCode} className="border-t border-border/40">
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{p.stt}</td>
                    <td className="px-3 py-1.5">
                      <p className="font-medium">{p.productName}</p>
                      <p className="text-[11px] text-muted-foreground">{p.productCode}</p>
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums">
                      {formatNumber(p.quantity)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums text-primary">
                      {formatVnd(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CustomProductGroupDetailDialog({
  open,
  onOpenChange,
  group,
  lines,
  scopeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: CustomProductGroup | null;
  lines: SkuSalesLine[];
  scopeLabel?: string;
}) {
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

  const days = useMemo(
    () => (group ? buildCustomGroupDayDetails(group, lines) : []),
    [group, lines],
  );
  const employees = useMemo(
    () => (group ? buildCustomGroupEmployeeSummaries(group, lines) : []),
    [group, lines],
  );

  if (!group) return null;

  const qtyTotal = days.reduce((s, d) => s + d.quantityTotal, 0);
  const revTotal = days.reduce((s, d) => s + d.revenueTotal, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setExpandedEmp(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{group.name}</DialogTitle>
          <DialogDescription>
            Chi tiết theo ngày
            {scopeLabel ? ` · ${scopeLabel}` : ""}
            {" · "}
            {group.productCodes.length} mã · SL {formatNumber(qtyTotal)} · DT {formatVnd(revTotal)}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold">Theo nhân viên</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Bấm card nhân viên để xem STT / Tên sản phẩm / Số lượng / Doanh thu
            </p>
            {employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có doanh số trong khoảng lọc.</p>
            ) : (
              <div className="space-y-3">
                {employees.map((emp) => {
                  const openEmp = expandedEmp === emp.employeeName;
                  return (
                    <div
                      key={emp.employeeName}
                      className="overflow-hidden rounded-2xl border border-border/60 bg-lavender-soft/30"
                    >
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-4 py-3 text-left"
                        onClick={() =>
                          setExpandedEmp(openEmp ? null : emp.employeeName)
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{emp.employeeName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {emp.productCount} mã · SL{" "}
                            <span className="font-medium text-foreground">
                              {formatNumber(emp.quantity)}
                            </span>
                            {" · "}
                            DT{" "}
                            <span className="font-medium text-primary">
                              {formatVnd(emp.revenue)}
                            </span>
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            openEmp && "rotate-180",
                          )}
                        />
                      </button>
                      {openEmp && (
                        <div className="border-t border-border/50 px-3 pb-3 pt-2">
                          <EmployeeProductDays
                            group={group}
                            employeeName={emp.employeeName}
                            lines={lines}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Chi tiết theo ngày (toàn cửa hàng)</p>
            {days.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có dòng bán theo mã đã chọn.</p>
            ) : (
              <div className="space-y-4">
                {days.map((day) => (
                  <div key={day.date} className="overflow-hidden rounded-xl border border-border/60">
                    <div className="flex flex-wrap items-center gap-2 bg-lavender-soft/50 px-3 py-2">
                      <p className="text-sm font-semibold">{formatDateVi(day.date)}</p>
                      <span className="text-xs text-muted-foreground">
                        SL {formatNumber(day.quantityTotal)} · DT {formatVnd(day.revenueTotal)}
                      </span>
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full min-w-[520px] border-collapse text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="px-3 py-2 font-medium">STT</th>
                            <th className="px-3 py-2 font-medium">Tên sản phẩm</th>
                            <th className="px-3 py-2 text-right font-medium">Số lượng</th>
                            <th className="px-3 py-2 text-right font-medium">Doanh thu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {day.products.map((p) => (
                            <tr key={p.productCode} className="border-t border-border/40">
                              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                {p.stt}
                              </td>
                              <td className="px-3 py-2">
                                <p className="font-medium">{p.productName}</p>
                                <p className="text-[11px] text-muted-foreground">{p.productCode}</p>
                              </td>
                              <td className="px-3 py-2 text-right font-bold tabular-nums">
                                {formatNumber(p.quantity)}
                              </td>
                              <td className="px-3 py-2 text-right font-bold tabular-nums text-primary">
                                {formatVnd(p.revenue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
