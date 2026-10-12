"use client";

import { useState } from "react";
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
import { CountTable } from "@/components/check-stock/CountTable";
import { formatQty, formatWhen } from "@/lib/check-stock/format";
import { CATEGORY_LABEL } from "@/lib/check-stock/templates";
import type { CategoryId, CountLine, SessionDoc, SessionListItem, SystemRow } from "@/lib/check-stock/types";

export function SessionScreen({
  category,
  session,
  sessions,
  lines,
  rows,
  qtyTolerance,
  activeDatasetId,
  ungrouped,
  saveState,
  browseDate,
  onBrowseDate,
  onCategory,
  onOpen,
  onPatch,
  onExport,
  onReset,
  onSwitchDataset,
  onTolerance,
}: {
  category: CategoryId;
  session: SessionDoc | null;
  sessions: SessionListItem[];
  lines: CountLine[];
  rows: SystemRow[];
  qtyTolerance: number;
  activeDatasetId: string | null;
  ungrouped: { codes: number; sl: number };
  saveState: string;
  browseDate: string;
  onBrowseDate: (date: string) => void;
  onCategory: (category: CategoryId) => void;
  onOpen: (date: string, ca: string) => void;
  onPatch: (recipe: (doc: SessionDoc) => SessionDoc) => void;
  onExport: () => void;
  onReset: () => void;
  onSwitchDataset: () => void;
  onTolerance: (value: number) => void;
}) {
  const [ca, setCa] = useState(session?.ca || "1");
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const mine = sessions.filter((item) => item.category === category);
  const pinnedElsewhere = Boolean(session && activeDatasetId && session.datasetId !== activeDatasetId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_LABEL) as CategoryId[]).map((id) => (
          <Button key={id} size="sm" variant={id === category ? "default" : "outline"} onClick={() => onCategory(id)}>
            {CATEGORY_LABEL[id]}
          </Button>
        ))}
      </div>

      <section className="soft-card flex flex-wrap items-end gap-3 p-4">
        <label className="text-xs text-muted-foreground">
          Ngày
          <Input type="date" className="mt-1 w-40" value={browseDate} onChange={(event) => onBrowseDate(event.target.value)} />
        </label>
        <label className="text-xs text-muted-foreground">
          Ca
          <Input className="mt-1 w-28" value={ca} onChange={(event) => setCa(event.target.value)} />
        </label>
        <Button onClick={() => onOpen(browseDate, ca || "1")}>Mở phiên</Button>
        <p className="rounded-full bg-lavender-soft px-3 py-2 text-sm">
          Chưa có nhóm: {ungrouped.codes} mã, tổng SL {formatQty(ungrouped.sl)}
        </p>
      </section>

      {mine.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {mine.slice(0, 8).map((item) => (
            <button
              key={item.key}
              type="button"
              className="rounded-full bg-card px-3 py-1 text-xs shadow-[var(--shadow-soft)]"
              onClick={() => {
                onBrowseDate(item.date);
                setCa(item.ca);
                onOpen(item.date, item.ca);
              }}
            >
              {item.date.split("-").reverse().join("/")} · Ca {item.ca}
              {item.lastExportedAt ? ` · chốt ${formatWhen(item.lastExportedAt)}` : ""}
            </button>
          ))}
        </div>
      ) : null}

      {session ? (
        <>
          <section className="soft-card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="Ngày" type="date" value={session.date} onChange={(value) => onPatch((doc) => ({ ...doc, date: value }))} />
            <Field label="Giờ" type="time" value={session.time} onChange={(value) => onPatch((doc) => ({ ...doc, time: value }))} />
            <Field label="Ca" value={session.ca} onChange={(value) => onPatch((doc) => ({ ...doc, ca: value }))} />
            <Field label="Người kiểm hàng" value={session.inspector} onChange={(value) => onPatch((doc) => ({ ...doc, inspector: value }))} />
            <Field label="Kiểm soát" value={session.controller} onChange={(value) => onPatch((doc) => ({ ...doc, controller: value }))} />
            <label className="text-xs text-muted-foreground">
              Dung sai SL
              <Input
                className="mt-1"
                value={String(qtyTolerance)}
                onChange={(event) => onTolerance(Number(event.target.value.replace(",", ".")) || 0)}
              />
            </label>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-xs" placeholder="Tìm dòng" value={query} onChange={(event) => setQuery(event.target.value)} />
            <label className="text-sm">
              <input type="checkbox" className="mr-2" checked={onlyDiff} onChange={(event) => setOnlyDiff(event.target.checked)} />
              Chỉ dòng lệch
            </label>
            <span className="text-xs text-muted-foreground">{saveState}</span>
            {pinnedElsewhere ? (
              <Button size="sm" variant="outline" onClick={onSwitchDataset}>Chuyển sang dataset mới</Button>
            ) : null}
            <Button size="sm" className="ml-auto" onClick={onExport}>Chốt & xuất CSV</Button>
            <Button size="sm" variant="coral" onClick={() => setConfirmReset(true)}>Reset phiên</Button>
          </div>
          {session.lastExportedAt ? (
            <p className="text-xs text-muted-foreground">Lần chốt gần nhất: {formatWhen(session.lastExportedAt)}. Dữ liệu nhập vẫn giữ.</p>
          ) : null}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Phiên chưa gắn dataset nên SL hệ thống đang bằng 0.</p>
          ) : null}
          <CountTable
            lines={lines}
            session={session}
            rows={rows}
            qtyTolerance={qtyTolerance}
            onlyDiff={onlyDiff}
            query={query}
            onPatch={onPatch}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Chọn ngày, ca rồi bấm Mở phiên.</p>
      )}

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset phiên</DialogTitle>
            <DialogDescription>Xóa số đã nhập, ghi chú và trọng lượng ghi đè của phiên này. Ngày, ca và người giữ nguyên.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Huỷ</Button>
            <Button
              variant="coral"
              onClick={() => {
                setConfirmReset(false);
                onReset();
              }}
            >
              Xóa dữ liệu nhập
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
