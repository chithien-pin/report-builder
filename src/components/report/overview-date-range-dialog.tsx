"use client";

import { useEffect, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function OverviewDateRangeDialog({
  open,
  onOpenChange,
  availableDates,
  fromDate,
  toDate,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableDates: string[];
  fromDate: string | null;
  toDate: string | null;
  onApply: (fromDate: string | null, toDate: string | null) => void;
}) {
  const sorted = [...availableDates].sort();
  const minDate = sorted[0] ?? "";
  const maxDate = sorted[sorted.length - 1] ?? "";

  const [draftFrom, setDraftFrom] = useState(fromDate ?? minDate);
  const [draftTo, setDraftTo] = useState(toDate ?? maxDate);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(fromDate ?? minDate);
    setDraftTo(toDate ?? maxDate);
  }, [open, fromDate, toDate, minDate, maxDate]);

  function apply() {
    let from = draftFrom || null;
    let to = draftTo || null;
    if (from && to && from > to) {
      const tmp = from;
      from = to;
      to = tmp;
    }
    const fullRange =
      Boolean(minDate && maxDate) && from === minDate && to === maxDate;
    onApply(fullRange ? null : from, fullRange ? null : to);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lọc theo khoảng ngày</DialogTitle>
          <DialogDescription>
            Chọn từ ngày – đến ngày để lọc dữ liệu Tổng quan
            {minDate && maxDate
              ? ` (dữ liệu: ${formatDateVi(minDate)} – ${formatDateVi(maxDate)})`
              : ""}
            .
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="overview-from">Từ ngày</Label>
            <Input
              id="overview-from"
              type="date"
              className="rounded-xl"
              min={minDate || undefined}
              max={maxDate || undefined}
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="overview-to">Đến ngày</Label>
            <Input
              id="overview-to"
              type="date"
              className="rounded-xl"
              min={minDate || undefined}
              max={maxDate || undefined}
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onApply(null, null);
              onOpenChange(false);
            }}
          >
            Xóa lọc
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={apply} disabled={!draftFrom || !draftTo}>
              Áp dụng
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
