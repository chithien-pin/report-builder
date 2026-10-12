"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatQty } from "@/lib/check-stock/format";
import {
  assignRows,
  duplicatePrefixes,
  normalizePrefix,
  overlappingPrefixes,
  replacePrefixes,
  statsForLine,
} from "@/lib/check-stock/match";
import { CATEGORY_LABEL, sectionsFor, templateOf } from "@/lib/check-stock/templates";
import type { CategoryId, CountLine, LinesFile, SystemRow } from "@/lib/check-stock/types";
import { lineId } from "@/lib/check-stock/format";

type Confirm = { title: string; body: string; action: () => void };

export function LinesScreen({
  file,
  rows,
  onSave,
}: {
  file: LinesFile;
  rows: SystemRow[];
  onSave: (lines: CountLine[], qtyTolerance: number) => Promise<void>;
}) {
  const [category, setCategory] = useState<CategoryId>("loai1");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<CountLine | null>(null);
  const [prefixText, setPrefixText] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const sections = useMemo(() => {
    const extra = file.lines.filter((line) => line.category === category).map((line) => line.section);
    return sectionsFor(category, extra);
  }, [category, file.lines]);

  const previewLines = useMemo(() => {
    if (!draft) return file.lines;
    return replacePrefixes(file.lines, draft.id, draft.prefixes).map((line) =>
      line.id === draft.id ? draft : line,
    );
  }, [draft, file.lines]);

  const preview = useMemo(() => {
    if (!draft || rows.length === 0) return null;
    const assignment = assignRows(rows, previewLines);
    return statsForLine(draft, rows, assignment);
  }, [draft, previewLines, rows]);

  const dupes = useMemo(() => (draft ? duplicatePrefixes(previewLines) : []), [draft, previewLines]);
  const overlaps = useMemo(() => {
    if (!draft) return [];
    const mine = new Set(draft.prefixes.map((prefix) => normalizePrefix(prefix)));
    return overlappingPrefixes(previewLines).filter(
      (item) => mine.has(normalizePrefix(item.shorter)) || mine.has(normalizePrefix(item.longer)),
    );
  }, [draft, previewLines]);

  function beginEdit(line: CountLine) {
    setEditing(line.id);
    setDraft({ ...line, prefixes: [...line.prefixes] });
    setPrefixText("");
    setFormError(null);
  }

  async function persist(next: CountLine[], qtyTolerance = file.qtyTolerance) {
    setBusy(true);
    setFormError(null);
    try {
      await onSave(next, qtyTolerance);
      setEditing(null);
      setDraft(null);
      setAdding(null);
      setNewLabel("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không lưu được.");
    } finally {
      setBusy(false);
    }
  }

  function addPrefix() {
    if (!draft) return;
    const value = prefixText.trim().replace(/\*+$/g, "");
    if (!value) return;
    setDraft({ ...draft, prefixes: [...draft.prefixes, value], verified: true });
    setPrefixText("");
  }

  function askRemovePrefix(prefix: string) {
    if (!draft) return;
    const saved = file.lines.find((line) => line.id === draft.id)?.prefixes.includes(prefix);
    const remove = () => setDraft({ ...draft, prefixes: draft.prefixes.filter((item) => item !== prefix), verified: true });
    if (!saved) {
      remove();
      return;
    }
    setConfirm({
      title: "Bỏ đầu mã",
      body: `Bỏ đầu mã ${prefix}? Mã chỉ khớp đầu mã này sẽ về Chưa có nhóm.`,
      action: remove,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_LABEL) as CategoryId[]).map((id) => (
          <Button key={id} size="sm" variant={id === category ? "default" : "outline"} onClick={() => setCategory(id)}>
            {CATEGORY_LABEL[id]}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Quy tắc khớp trên cột Mã hàng của cả 3 loại. Đầu mã dài nhất thắng. {templateOf(category).title}.
      </p>
      {formError ? <p className="rounded-xl bg-coral-soft px-3 py-2 text-sm">{formError}</p> : null}

      {sections.map((section) => {
        const sectionLines = file.lines
          .filter((line) => line.category === category && line.section === section.id)
          .sort((a, b) => a.order - b.order);
        return (
          <section key={section.id} className="soft-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-medium">{section.title}</h2>
              <Button size="sm" variant="outline" onClick={() => { setAdding(section.id); setNewLabel(""); }}>
                Thêm dòng
              </Button>
            </div>
            {adding === section.id ? (
              <form
                className="mb-3 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const label = newLabel.trim();
                  if (!label) return;
                  const order = Math.max(0, ...sectionLines.map((line) => line.order)) + 1;
                  const id = `${lineId(category, section.id, label)}_${order}`;
                  const created: CountLine = {
                    id,
                    category,
                    section: section.id,
                    label,
                    prefixes: [],
                    mode: section.weight ? "weight" : "qty",
                    verified: true,
                    order,
                  };
                  void persist([...file.lines, created]);
                }}
              >
                <Input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Tên dòng" className="max-w-xs" />
                <Button type="submit" size="sm" disabled={busy}>Tạo</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(null)}>Huỷ</Button>
              </form>
            ) : null}
            <div className="space-y-2">
              {sectionLines.map((line) => (
                <div key={line.id} className="rounded-2xl bg-muted/60 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="text-left font-medium" onClick={() => beginEdit(line)}>
                      {line.label}
                    </button>
                    {line.verified ? null : (
                      <span className="rounded-full bg-coral-soft px-2 py-0.5 text-xs">Chưa xác nhận</span>
                    )}
                    {line.mode === "weight" ? <span className="text-xs text-muted-foreground">Nhập TL</span> : null}
                    {line.countOnly ? <span className="text-xs text-muted-foreground">Ô số</span> : null}
                    <span className="text-xs text-muted-foreground">
                      {line.prefixes.length ? line.prefixes.join(", ") : "Chưa có đầu mã"}
                    </span>
                    <span className="ml-auto flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => move(line, -1)} disabled={busy}>Lên</Button>
                      <Button size="sm" variant="ghost" onClick={() => move(line, 1)} disabled={busy}>Xuống</Button>
                      {line.verified ? null : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void persist(file.lines.map((item) => (item.id === line.id ? { ...item, verified: true } : item)))}
                        >
                          Xác nhận
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirm({
                            title: "Xóa dòng",
                            body: `Xóa "${line.label}"? Mã đang khớp dòng này sẽ về Chưa có nhóm.`,
                            action: () => void persist(file.lines.filter((item) => item.id !== line.id)),
                          })
                        }
                      >
                        Xóa
                      </Button>
                    </span>
                  </div>
                  {editing === line.id && draft ? (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      <label className="block text-xs text-muted-foreground">
                        Tên dòng
                        <Input className="mt-1" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value, verified: true })} />
                      </label>
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">Đầu mã</p>
                        <div className="flex flex-wrap gap-1">
                          {draft.prefixes.map((prefix) => (
                            <button
                              key={prefix}
                              type="button"
                              className="rounded-full bg-card px-2 py-1 text-xs"
                              onClick={() => askRemovePrefix(prefix)}
                            >
                              {prefix} ×
                            </button>
                          ))}
                        </div>
                        <form
                          className="mt-2 flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            addPrefix();
                          }}
                        >
                          <Input
                            value={prefixText}
                            onChange={(event) => setPrefixText(event.target.value)}
                            placeholder="Thêm đầu mã, Enter"
                            className="max-w-xs"
                          />
                          <Button type="submit" size="sm" variant="outline">Thêm</Button>
                        </form>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <label className="text-xs text-muted-foreground">
                          unitWeight
                          <Input
                            className="mt-1 w-28"
                            value={draft.unitWeight ?? ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                verified: true,
                                unitWeight: event.target.value === "" ? undefined : Number(event.target.value.replace(",", ".")),
                              })
                            }
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          Dung sai TL
                          <Input
                            className="mt-1 w-28"
                            value={draft.weightTolerance ?? ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                verified: true,
                                weightTolerance: event.target.value === "" ? undefined : Number(event.target.value.replace(",", ".")),
                              })
                            }
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          Chế độ nhập
                          <select
                            className="mt-1 block h-10 rounded-full bg-card px-3 text-sm"
                            value={draft.mode}
                            onChange={(event) => setDraft({ ...draft, mode: event.target.value === "weight" ? "weight" : "qty", verified: true })}
                          >
                            <option value="qty">Số lượng</option>
                            <option value="weight">Trọng lượng</option>
                          </select>
                        </label>
                      </div>
                      {preview ? (
                        <div className="rounded-xl bg-card px-3 py-2 text-sm">
                          <p>Khớp {preview.count} mã, tổng SL {formatQty(preview.sl)}, tổng TL {formatQty(preview.tl)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{preview.samples.join(", ") || "Không có mã mẫu"}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Chưa có dataset đang dùng để xem trước.</p>
                      )}
                      {dupes.length > 0 ? <p className="text-sm text-destructive">Không lưu được vì trùng đầu mã: {dupes.join(", ")}</p> : null}
                      {overlaps.length > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Chồng lấn khác độ dài (đầu mã dài hơn sẽ thắng): {overlaps.slice(0, 6).map((item) => `${item.shorter} ⊂ ${item.longer}`).join("; ")}
                        </p>
                      ) : null}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busy || dupes.length > 0 || !draft.label.trim()}
                          onClick={() => void persist(previewLines.map((line) => (line.id === draft.id ? { ...draft, label: draft.label.trim() } : line)))}
                        >
                          Lưu dòng
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setDraft(null); }}>Đóng</Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <Dialog open={Boolean(confirm)} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>Huỷ</Button>
            <Button
              variant="coral"
              onClick={() => {
                const action = confirm?.action;
                setConfirm(null);
                action?.();
              }}
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function move(line: CountLine, dir: -1 | 1) {
    const siblings = file.lines
      .filter((item) => item.category === line.category && item.section === line.section)
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((item) => item.id === line.id);
    const swap = siblings[index + dir];
    if (!swap) return;
    const next = file.lines.map((item) => {
      if (item.id === line.id) return { ...item, order: swap.order };
      if (item.id === swap.id) return { ...item, order: line.order };
      return item;
    });
    void persist(next);
  }
}
