"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { CustomProductGroupDetailDialog } from "@/components/report/custom-product-group-detail-dialog";
import { CustomProductGroupDialog } from "@/components/report/custom-product-group-dialog";
import { Button } from "@/components/ui/button";
import { buildCustomGroupBreakdownRow } from "@/lib/report/custom-product-groups";
import type {
  CustomProductGroup,
  EmployeeTargetBreakdownRow,
  ProductCatalogItem,
  SkuSalesLine,
} from "@/lib/report/types";
import { cn, formatNumber, formatPctVi, formatVnd } from "@/lib/utils";

function isTrangSucKhacCategory(label: string): boolean {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("trang suc khac");
}

function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function BreakdownRowView({
  row,
  hideSl,
  revenueSharePct,
  onClick,
  actions,
}: {
  row: EmployeeTargetBreakdownRow;
  hideSl: boolean;
  revenueSharePct: number | null;
  onClick?: () => void;
  actions?: ReactNode;
}) {
  const dtPctRow = row.dtPlan > 0 ? row.dtActual / row.dtPlan : null;
  const slPctRow = !hideSl && row.slPlan > 0 ? row.slActual / row.slPlan : null;
  const weak =
    (dtPctRow != null && dtPctRow < 0.7) || (slPctRow != null && slPctRow < 0.7);
  const dtGood = dtPctRow != null && dtPctRow >= 1;
  const slGood = slPctRow != null && slPctRow >= 1;

  return (
    <tr
      className={cn(
        "border-t border-border/40",
        weak && "bg-coral-soft/30",
        onClick && "cursor-pointer hover:bg-lavender-soft/50",
      )}
      onClick={onClick}
    >
      <td className="px-3 py-2.5 font-medium">
        <div className="flex items-center gap-2">
          <span>{row.label}</span>
          {actions}
        </div>
      </td>
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
      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-foreground">
        {revenueSharePct != null ? formatPctVi(revenueSharePct) : "—"}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
        {hideSl ? (
          "—"
        ) : (
          <>
            <span className="font-bold text-foreground">{formatNumber(row.slActual)}</span>
            <span className="text-muted-foreground"> / {formatNumber(row.slPlan)}</span>
          </>
        )}
      </td>
      <td
        className={cn(
          "px-3 py-2.5 text-right font-bold tabular-nums",
          hideSl ? "text-muted-foreground" : slGood ? "text-success" : "text-coral",
        )}
      >
        {hideSl ? "—" : slPctRow != null ? formatPctVi(slPctRow) : "—"}
      </td>
    </tr>
  );
}

export function StoreCategoryTargetCard({
  rows,
  scopeLabel,
  asOfDate,
  customGroups,
  catalog,
  skuLines,
  onUpsertGroup,
  onRemoveGroup,
}: {
  rows: EmployeeTargetBreakdownRow[];
  scopeLabel?: string;
  asOfDate?: string;
  customGroups: CustomProductGroup[];
  catalog: ProductCatalogItem[];
  skuLines: SkuSalesLine[];
  onUpsertGroup: (group: CustomProductGroup) => void;
  onRemoveGroup: (id: string) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CustomProductGroup | null>(null);
  const [detailGroup, setDetailGroup] = useState<CustomProductGroup | null>(null);

  const customRows = useMemo(
    () =>
      customGroups.map((g) => ({
        group: g,
        row: buildCustomGroupBreakdownRow(g, skuLines),
      })),
    [customGroups, skuLines],
  );
  const totalRevenue = useMemo(
    () =>
      rows.reduce((sum, row) => sum + row.dtActual, 0) +
      customRows.reduce((sum, item) => sum + item.row.dtActual, 0),
    [customRows, rows],
  );

  return (
    <>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nhóm MA HANG
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Tiến độ chỉ tiêu toàn cửa hàng
            {asOfDate ? ` · lũy kế đến ${formatDateVi(asOfDate)}` : ""}
            {customGroups.length > 0
              ? " · bấm hàng nhóm custom để xem chi tiết theo ngày / nhân viên"
              : ""}
            {" · tỉ trọng = doanh thu thực / tổng doanh thu hiển thị"}
          </p>
        </div>

        <div className="overflow-auto px-2 pb-2 pt-2">
          <div className="overflow-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-lavender-soft/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Danh mục</th>
                  <th className="px-3 py-2.5 text-right font-medium">Doanh thu thực / Kế hoạch</th>
                  <th className="px-3 py-2.5 text-right font-medium">% Doanh thu</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tỉ trọng</th>
                  <th className="px-3 py-2.5 text-right font-medium">Sản lượng thực / Kế hoạch</th>
                  <th className="px-3 py-2.5 text-right font-medium">% Sản lượng</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && customRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Chưa có dữ liệu ngành hàng. Bấm &quot;Nhóm MA HANG&quot; để tạo nhóm theo mã sản phẩm.
                    </td>
                  </tr>
                ) : null}
                {rows.map((row) => (
                  <BreakdownRowView
                    key={row.label}
                    row={row}
                    hideSl={isTrangSucKhacCategory(row.label)}
                    revenueSharePct={totalRevenue > 0 ? row.dtActual / totalRevenue : null}
                  />
                ))}
                {customRows.map(({ group, row }) => (
                  <BreakdownRowView
                    key={group.id}
                    row={row}
                    hideSl={false}
                    revenueSharePct={totalRevenue > 0 ? row.dtActual / totalRevenue : null}
                    onClick={() => setDetailGroup(group)}
                    actions={
                      <span
                        className="flex shrink-0 items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Sửa nhóm"
                          onClick={() => {
                            setEditing(group);
                            setEditorOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                          aria-label="Xóa nhóm"
                          onClick={() => onRemoveGroup(group.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CustomProductGroupDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        catalog={catalog}
        value={editing}
        onSave={onUpsertGroup}
      />
      <CustomProductGroupDetailDialog
        open={detailGroup != null}
        onOpenChange={(open) => {
          if (!open) setDetailGroup(null);
        }}
        group={detailGroup}
        lines={skuLines}
        scopeLabel={scopeLabel}
      />
    </>
  );
}
