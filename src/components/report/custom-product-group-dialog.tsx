"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { CustomProductGroup, ProductCatalogItem } from "@/lib/report/types";

function newId(): string {
  return `cpg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CustomProductGroupDialog({
  open,
  onOpenChange,
  catalog,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: ProductCatalogItem[];
  value: CustomProductGroup | null;
  onSave: (group: CustomProductGroup) => void;
}) {
  const [name, setName] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [dtPlan, setDtPlan] = useState("");
  const [slPlan, setSlPlan] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(value?.name ?? "");
    setCodes(value?.productCodes ?? []);
    setDtPlan(value?.dtPlan ? String(value.dtPlan) : "");
    setSlPlan(value?.slPlan ? String(value.slPlan) : "");
    setQuery("");
  }, [open, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (item) =>
        item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q),
    );
  }, [catalog, query]);

  function toggleCode(code: string) {
    setCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed || codes.length === 0) return;
    onSave({
      id: value?.id ?? newId(),
      name: trimmed,
      productCodes: codes,
      dtPlan: Number(dtPlan.replace(/\s/g, "").replace(/,/g, "")) || 0,
      slPlan: Number(slPlan.replace(/\s/g, "").replace(/,/g, "")) || 0,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{value ? "Sửa nhóm sản phẩm" : "Thêm nhóm theo MA HANG"}</DialogTitle>
          <DialogDescription>
            Chọn mã hàng từ file doanh số, đặt tên custom và nhập chỉ tiêu kế hoạch (nếu có).
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpg-name">Tên nhóm</Label>
            <Input
              id="cpg-name"
              placeholder="Ví dụ: Nhóm nhẫn bán chạy"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cpg-dt">Kế hoạch doanh thu (đ)</Label>
              <Input
                id="cpg-dt"
                type="number"
                className="rounded-xl"
                value={dtPlan}
                onChange={(e) => setDtPlan(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpg-sl">Kế hoạch sản lượng (SL theo ĐVT)</Label>
              <Input
                id="cpg-sl"
                type="number"
                className="rounded-xl"
                value={slPlan}
                onChange={(e) => setSlPlan(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Mã hàng ({codes.length} đã chọn)</Label>
              <Input
                placeholder="Tìm mã / tên…"
                className="h-8 max-w-[220px] rounded-xl"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {catalog.length === 0 ? (
              <p className="rounded-xl bg-lavender-soft px-3 py-2 text-sm text-muted-foreground">
                Chưa có MA HANG trong dữ liệu. Hãy upload lại file doanh số để cập nhật schema.
              </p>
            ) : (
              <div className="max-h-64 overflow-auto rounded-xl border border-border/60">
                <ul className="divide-y divide-border/40">
                  {filtered.map((item) => {
                    const checked = codes.includes(item.code);
                    return (
                      <li key={item.code}>
                        <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-lavender-soft/40">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleCode(item.code)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium tabular-nums">{item.code}</span>
                            <span className="block text-xs text-muted-foreground">{item.name}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            type="button"
            disabled={!name.trim() || codes.length === 0}
            onClick={save}
          >
            Lưu nhóm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
