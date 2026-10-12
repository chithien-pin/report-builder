"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatQty, lineId } from "@/lib/check-stock/format";
import { assignRows, duplicatePrefixes, statsForLine, ungroupedBuckets, type UngroupedBucket } from "@/lib/check-stock/match";
import { CATEGORY_LABEL, sectionsFor } from "@/lib/check-stock/templates";
import type { CategoryId, CountLine, SystemRow } from "@/lib/check-stock/types";

export function UngroupedScreen({
  lines,
  rows,
  onSave,
}: {
  lines: CountLine[];
  rows: SystemRow[];
  onSave: (lines: CountLine[]) => Promise<void>;
}) {
  const buckets = useMemo(() => ungroupedBuckets(rows, lines), [rows, lines]);
  const [bucket, setBucket] = useState<UngroupedBucket | null>(null);
  const [target, setTarget] = useState("");
  const [section, setSection] = useState("");
  const [newCategory, setNewCategory] = useState<CategoryId>("loai1");
  const [label, setLabel] = useState("");
  const [prefix, setPrefix] = useState("");
  const [length, setLength] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const source = bucket?.samples[0] ?? bucket?.prefix ?? "";
  const creating = target === "__new__";

  const preview = useMemo(() => {
    if (!bucket || !prefix.trim()) return null;
    const next = applyPrefix(lines, target, prefix.trim(), newCategory, section, label);
    if (!next) return null;
    const assignment = assignRows(rows, next.lines);
    const line = next.lines.find((item) => item.id === next.lineId);
    if (!line) return null;
    return statsForLine(line, rows, assignment);
  }, [bucket, label, lines, newCategory, prefix, rows, section, target]);

  function open(item: UngroupedBucket) {
    const initial = item.samples[0]?.slice(0, item.prefix.length) || item.prefix;
    setBucket(item);
    setPrefix(initial);
    setLength(initial.length || 1);
    setTarget(lines[0]?.id ?? "__new__");
    setSection(lines[0]?.section ?? "VÀNG TA");
    setLabel(item.tenChungLoai || item.prefix);
    setError(null);
  }

  async function save() {
    const next = applyPrefix(lines, target, prefix.trim(), newCategory, section, label);
    if (!next) {
      setError("Chọn dòng đích và nhập đầu mã.");
      return;
    }
    const dupes = duplicatePrefixes(next.lines);
    if (dupes.length > 0) {
      setError(`Đầu mã bị trùng: ${dupes.join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      await onSave(next.lines);
      setBucket(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được.");
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Hãy đặt một dataset làm dữ liệu đang dùng để xem mã chưa có nhóm.</p>;
  }

  return (
    <div className="soft-card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-3">Đầu mã gợi ý</th>
            <th className="px-3 py-3">Tên nhóm lớn</th>
            <th className="px-3 py-3">Tên chủng loại</th>
            <th className="px-3 py-3 text-right">Số mã</th>
            <th className="px-3 py-3 text-right">Tổng SL</th>
            <th className="px-3 py-3">3 mã mẫu</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {buckets.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-muted-foreground">Mọi mã đã có nhóm.</td>
            </tr>
          ) : buckets.map((item) => (
            <tr key={item.key} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{item.prefix}</td>
              <td className="px-3 py-2">{item.tenNhomLon || "—"}</td>
              <td className="px-3 py-2">{item.tenChungLoai || "—"}</td>
              <td className="px-3 py-2 text-right">{item.count}</td>
              <td className="px-3 py-2 text-right">{formatQty(item.sl)}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{item.samples.join(", ")}</td>
              <td className="px-3 py-2 text-right">
                <Button size="sm" variant="outline" onClick={() => open(item)}>Tạo quy tắc</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={Boolean(bucket)} onOpenChange={(openDialog) => { if (!openDialog) setBucket(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo quy tắc</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <label className="block text-xs text-muted-foreground">
              Dòng đích
              <select className="mt-1 h-10 w-full rounded-full bg-muted px-3 text-sm" value={target} onChange={(event) => setTarget(event.target.value)}>
                {(Object.keys(CATEGORY_LABEL) as CategoryId[]).map((category) => {
                  const extra = lines.filter((line) => line.category === category).map((line) => line.section);
                  return sectionsFor(category, extra).map((sectionItem) => (
                    <optgroup key={`${category}-${sectionItem.id}`} label={`${CATEGORY_LABEL[category]} / ${sectionItem.title}`}>
                      {lines
                        .filter((line) => line.category === category && line.section === sectionItem.id && !line.countOnly)
                        .sort((a, b) => a.order - b.order)
                        .map((line) => (
                          <option key={line.id} value={line.id}>{line.label}</option>
                        ))}
                    </optgroup>
                  ));
                })}
                <option value="__new__">Tạo dòng mới</option>
              </select>
            </label>
            {creating ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground sm:col-span-2">
                  Loại
                  <select className="mt-1 h-10 w-full rounded-full bg-muted px-3 text-sm" value={newCategory} onChange={(event) => setNewCategory(event.target.value as CategoryId)}>
                    {(Object.keys(CATEGORY_LABEL) as CategoryId[]).map((id) => (
                      <option key={id} value={id}>{CATEGORY_LABEL[id]}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Khối
                  <Input className="mt-1" value={section} onChange={(event) => setSection(event.target.value)} />
                </label>
                <label className="text-xs text-muted-foreground">
                  Tên dòng
                  <Input className="mt-1" value={label} onChange={(event) => setLabel(event.target.value)} />
                </label>
              </div>
            ) : null}
            <label className="block text-xs text-muted-foreground">
              Độ dài đầu mã ({length})
              <input
                type="range"
                min={1}
                max={Math.max(source.length, 1)}
                value={Math.min(length, Math.max(source.length, 1))}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setLength(next);
                  setPrefix(source.slice(0, next));
                }}
                className="mt-2 w-full"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Đầu mã
              <Input
                className="mt-1"
                value={prefix}
                onChange={(event) => {
                  setPrefix(event.target.value);
                  setLength(event.target.value.length);
                }}
              />
            </label>
            {preview ? (
              <p className="rounded-xl bg-muted px-3 py-2 text-sm">
                Khớp {preview.count} mã, tổng SL {formatQty(preview.sl)}, tổng TL {formatQty(preview.tl)}
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </DialogBody>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBucket(null)}>Huỷ</Button>
            <Button disabled={busy || !prefix.trim()} onClick={() => void save()}>Lưu đầu mã</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function applyPrefix(
  lines: CountLine[],
  target: string,
  prefix: string,
  category: CategoryId,
  section: string,
  label: string,
) {
  if (!prefix) return null;
  if (target === "__new__") {
    if (!section.trim() || !label.trim()) return null;
    const order = Math.max(0, ...lines.filter((line) => line.category === category && line.section === section.trim()).map((line) => line.order)) + 1;
    const created: CountLine = {
      id: `${lineId(category, section.trim(), label.trim())}_${order}`,
      category,
      section: section.trim(),
      label: label.trim(),
      prefixes: [prefix],
      mode: "qty",
      verified: true,
      order,
    };
    return { lines: [...lines, created], lineId: created.id };
  }
  const current = lines.find((line) => line.id === target);
  if (!current) return null;
  return {
    lineId: current.id,
    lines: lines.map((line) =>
      line.id === current.id ? { ...line, prefixes: [...line.prefixes, prefix], verified: true } : line,
    ),
  };
}
