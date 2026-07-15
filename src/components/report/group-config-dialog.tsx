"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";

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
import { createDefaultGroupConfig, newEmptyGroup } from "@/lib/report/preset";
import type { GroupConfig, ReportGroup, TargetColumn } from "@/lib/report/types";
import { cn } from "@/lib/utils";

export function GroupConfigDialog({
  open,
  onOpenChange,
  productLines,
  targetColumns,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productLines: string[];
  targetColumns: TargetColumn[];
  value: GroupConfig;
  onSave: (config: GroupConfig) => void;
}) {
  const [draft, setDraft] = useState<GroupConfig>(value);
  const [activeId, setActiveId] = useState<string>(value.groups[0]?.id ?? "");

  const usedLines = useMemo(() => {
    const set = new Set<string>();
    for (const g of draft.groups) {
      for (const p of g.productLines) set.add(p);
    }
    return set;
  }, [draft]);

  const unusedLines = productLines.filter((p) => !usedLines.has(p));
  const active = draft.groups.find((g) => g.id === activeId) ?? draft.groups[0];

  function updateGroup(id: string, patch: Partial<ReportGroup>) {
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }

  function toggleLine(groupId: string, line: string) {
    const group = draft.groups.find((g) => g.id === groupId);
    if (!group) return;
    const has = group.productLines.includes(line);
    // remove from other groups first
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            productLines: has
              ? g.productLines.filter((p) => p !== line)
              : [...g.productLines, line],
          };
        }
        return { ...g, productLines: g.productLines.filter((p) => p !== line) };
      }),
    }));
  }

  function addGroup() {
    const g = newEmptyGroup(`Nhóm ${draft.groups.length + 1}`);
    setDraft((prev) => ({ ...prev, groups: [...prev.groups, g] }));
    setActiveId(g.id);
  }

  function removeGroup(id: string) {
    setDraft((prev) => {
      const groups = prev.groups.filter((g) => g.id !== id);
      return {
        ...prev,
        groups,
        fallbackGroupId:
          prev.fallbackGroupId === id ? (groups[0]?.id ?? null) : prev.fallbackGroupId,
      };
    });
    if (activeId === id) setActiveId(draft.groups.find((g) => g.id !== id)?.id ?? "");
  }

  function resetDefault() {
    const next = createDefaultGroupConfig(targetColumns);
    setDraft(next);
    setActiveId(next.groups[0]?.id ?? "");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setDraft(value);
          setActiveId(value.groups[0]?.id ?? "");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cấu hình nhóm</DialogTitle>
          <DialogDescription>
            Gán dòng sản phẩm và cột chỉ tiêu vào từng nhóm. Có thể tự đặt tên nhóm.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {draft.groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveId(g.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm transition-colors",
                  g.id === active?.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-lavender-soft text-accent-foreground hover:bg-lavender/50",
                )}
              >
                {g.name}
              </button>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addGroup}>
              <Plus className="h-3.5 w-3.5" />
              Thêm nhóm
            </Button>
          </div>

          {active && (
            <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <Label htmlFor="group-name">Tên nhóm</Label>
                  <Input
                    id="group-name"
                    className="mt-1"
                    value={active.name}
                    onChange={(e) => updateGroup(active.id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Đơn vị SL</Label>
                  <div className="mt-1 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={active.slUnit === "chi" ? "default" : "outline"}
                      onClick={() => updateGroup(active.id, { slUnit: "chi" })}
                    >
                      Chỉ
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={active.slUnit === "chiec" ? "default" : "outline"}
                      onClick={() => updateGroup(active.id, { slUnit: "chiec" })}
                    >
                      Chiếc
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => removeGroup(active.id)}
                  disabled={draft.groups.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Cột chỉ tiêu doanh thu</Label>
                  <select
                    className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                    value={active.targetDtColumn ?? ""}
                    onChange={(e) =>
                      updateGroup(active.id, {
                        targetDtColumn: e.target.value || null,
                      })
                    }
                  >
                    <option value="">— Không gắn —</option>
                    {targetColumns.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Cột chỉ tiêu sản lượng</Label>
                  <select
                    className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                    value={active.targetSlColumn ?? ""}
                    onChange={(e) =>
                      updateGroup(active.id, {
                        targetSlColumn: e.target.value || null,
                      })
                    }
                  >
                    <option value="">— Không gắn —</option>
                    {targetColumns.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label>Dòng sản phẩm trong nhóm</Label>
                <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {active.productLines.map((line) => (
                    <button
                      key={line}
                      type="button"
                      onClick={() => toggleLine(active.id, line)}
                      className="rounded-full bg-lavender-soft px-2.5 py-1 text-xs text-primary hover:bg-destructive/15 hover:text-destructive"
                    >
                      {line} ×
                    </button>
                  ))}
                  {active.productLines.length === 0 && (
                    <span className="text-xs text-muted-foreground">Chưa có dòng nào</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Dòng sản phẩm chưa gán</Label>
            <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-lg border border-dashed border-border p-3">
              {unusedLines.length === 0 ? (
                <span className="text-xs text-muted-foreground">Đã gán hết</span>
              ) : (
                unusedLines.map((line) => (
                  <button
                    key={line}
                    type="button"
                    disabled={!active}
                    onClick={() => active && toggleLine(active.id, line)}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs hover:border-primary hover:bg-accent"
                  >
                    + {line}
                  </button>
                ))
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Dòng chưa gán sẽ vào nhóm fallback:{" "}
              <select
                className="ml-1 rounded border border-input bg-card px-2 py-0.5 text-xs"
                value={draft.fallbackGroupId ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    fallbackGroupId: e.target.value || null,
                  }))
                }
              >
                <option value="">— Loại bỏ —</option>
                {draft.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </p>
          </div>
        </DialogBody>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={resetDefault}>
            <RotateCcw className="h-4 w-4" />
            Khôi phục mặc định
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              Lưu cấu hình
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
