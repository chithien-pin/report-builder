"use client";

import { Settings2 } from "lucide-react";

import { FilterConfig } from "@/components/column-selector/filter-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hasValidFilterSelection, useDashboardStore } from "@/lib/store";

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilterDialog({ open, onOpenChange }: FilterDialogProps) {
  const meta = useDashboardStore((s) => s.meta);
  const primaryGroupColumn = useDashboardStore((s) => s.primaryGroupColumn);
  const secondaryGroupColumns = useDashboardStore((s) => s.secondaryGroupColumns);
  const selectedValuesByColumn = useDashboardStore((s) => s.selectedValuesByColumn);
  const sumColumns = useDashboardStore((s) => s.sumColumns);

  const isValid =
    hasValidFilterSelection(primaryGroupColumn, secondaryGroupColumns, selectedValuesByColumn) &&
    sumColumns.length > 0;

  if (!meta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-bronze" />
            Cấu hình nhóm & filter
          </DialogTitle>
          <DialogDescription>
            Nhóm chính tạo tab. Nhóm phụ lọc và cộng tổng trong mỗi tab. Dashboard cập nhật sau khi đóng.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <FilterConfig columns={meta.columns} dialog />
        </DialogBody>

        <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant={primaryGroupColumn ? "default" : "secondary"}>
              {primaryGroupColumn ? "1 nhóm chính" : "Chưa có nhóm chính"}
            </Badge>
            <Badge variant={secondaryGroupColumns.length > 0 ? "default" : "secondary"}>
              {secondaryGroupColumns.length} nhóm phụ
            </Badge>
            <Badge variant={isValid ? "default" : "secondary"}>
              {sumColumns.length} cột sum
            </Badge>
            {!isValid && <span>Chưa đủ cấu hình để hiển thị dashboard</span>}
          </div>
          <Button onClick={() => onOpenChange(false)} disabled={!isValid}>
            Xong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
