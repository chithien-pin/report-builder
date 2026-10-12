"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQty, formatWhen, round4 } from "@/lib/check-stock/format";
import { summarize } from "@/lib/check-stock/match";
import { parseSystemFile, type ImportReport } from "@/lib/check-stock/parse";
import { CATEGORY_LABEL } from "@/lib/check-stock/templates";
import { DEFAULT_COLUMNS, type CategoryId, type ColumnMap, type CountLine, type DatasetFile, type DatasetMeta, type DatasetsIndex } from "@/lib/check-stock/types";

export function DatasetsScreen({
  index,
  lines,
  sessionDate,
  onSave,
  onActivate,
}: {
  index: DatasetsIndex;
  lines: CountLine[];
  sessionDate: string;
  onSave: (file: DatasetFile, meta: DatasetMeta, activate: boolean) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
}) {
  const [columns, setColumns] = useState<ColumnMap>(DEFAULT_COLUMNS);
  const [importer, setImporter] = useState("");
  const [activate, setActivate] = useState(true);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const summary = useMemo(() => (report ? summarize(report.rows, lines) : null), [report, lines]);
  const totalQty = report ? round4(report.rows.reduce((sum, row) => sum + row.sl, 0)) : 0;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setParsing(true);
    setError(null);
    setMessage(null);
    setFileName(file.name);
    try {
      const parsed = await parseSystemFile(file, columns);
      if ("error" in parsed) {
        setReport(null);
        setError(parsed.error);
        return;
      }
      setReport(parsed);
    } catch (caught) {
      setReport(null);
      setError(caught instanceof Error ? caught.message : "Không đọc được file.");
    } finally {
      setParsing(false);
    }
  }

  async function save() {
    if (!report) return;
    if (!importer.trim()) {
      setError("Nhập tên người import.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = `ds_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const file: DatasetFile = { id, reportDate: report.reportDate, rows: report.rows };
      const meta: DatasetMeta = {
        id,
        fileName,
        importedAt: new Date().toISOString(),
        importedBy: importer.trim(),
        rowCount: report.readCount,
        totalQty,
        reportDate: report.reportDate,
      };
      await onSave(file, meta, activate);
      setReport(null);
      setMessage("Đã lưu dataset.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được dataset.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="soft-card space-y-3 p-4">
        <h2 className="font-medium">Import tồn Augges</h2>
        <p className="text-sm text-muted-foreground">File được đọc trên trình duyệt. Chỉ bản dòng chi tiết được lưu, không upload file gốc.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            Người import
            <Input className="mt-1 w-56" value={importer} onChange={(event) => setImporter(event.target.value)} />
          </label>
          <label className="text-sm">
            <input type="checkbox" className="mr-2" checked={activate} onChange={(event) => setActivate(event.target.checked)} />
            Đặt làm dữ liệu đang dùng
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Tên cột</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(Object.keys(DEFAULT_COLUMNS) as (keyof ColumnMap)[]).map((key) => (
              <label key={key} className="text-xs text-muted-foreground">
                {key}
                <Input className="mt-1" value={columns[key]} onChange={(event) => setColumns({ ...columns, [key]: event.target.value })} />
              </label>
            ))}
          </div>
        </details>
        {parsing ? <p className="text-sm">Đang đọc file…</p> : null}
        {error ? <p className="rounded-xl bg-coral-soft px-3 py-2 text-sm">{error}</p> : null}
        {message ? <p className="text-sm text-success">{message}</p> : null}
        {report && summary ? (
          <div className="space-y-2 rounded-2xl bg-muted/70 p-3 text-sm">
            <p>Dòng header số {report.headerRow}. Đọc {report.readCount} mã, bỏ qua {report.skippedCount} dòng tổng/trống.</p>
            {report.reportDate ? <p>Ngày trong file: {report.reportDate.split("-").reverse().join("/")}</p> : <p>Không thấy dòng Ngày dd/mm/yyyy.</p>}
            {report.reportDate && sessionDate && report.reportDate !== sessionDate ? (
              <p>Ngày file khác ngày phiên đang chọn ({sessionDate.split("-").reverse().join("/")})</p>
            ) : null}
            {report.missingColumns.length > 0 ? <p>Thiếu cột: {report.missingColumns.join(", ")}</p> : <p>Đủ các cột đã cấu hình.</p>}
            {report.duplicateCodes.length > 0 ? (
              <p>Mã trùng đã cộng dồn ({report.duplicateCodes.length}): {report.duplicateCodes.slice(0, 8).join(", ")}</p>
            ) : null}
            {report.integrity.length > 0 ? (
              <div>
                <p>Lệch tổng theo Mã nhóm (không chặn import):</p>
                <ul className="list-disc pl-5">
                  {report.integrity.slice(0, 12).map((gap) => (
                    <li key={gap.maNhom}>{gap.maNhom}: chi tiết {formatQty(gap.detailSl)} / dòng tổng {formatQty(gap.totalSl)}</li>
                  ))}
                </ul>
              </div>
            ) : <p>Tổng SL chi tiết khớp dòng tổng theo từng Mã nhóm.</p>}
            <p>
              Phân loại: {(Object.keys(CATEGORY_LABEL) as CategoryId[]).map((id) => `${CATEGORY_LABEL[id]} ${summary.per[id].codes} mã`).join(" · ")} · Chưa có nhóm {summary.ungrouped.codes} mã, SL {formatQty(summary.ungrouped.sl)}
            </p>
            <Button disabled={saving} onClick={() => void save()}>{saving ? "Đang lưu…" : "Lưu dataset"}</Button>
          </div>
        ) : null}
      </section>

      <section className="soft-card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Tên file</th>
              <th className="px-3 py-3">Thời điểm</th>
              <th className="px-3 py-3">Người import</th>
              <th className="px-3 py-3 text-right">Số dòng</th>
              <th className="px-3 py-3 text-right">Tổng SL</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {index.items.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-muted-foreground">Chưa có dataset.</td></tr>
            ) : index.items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-3 py-2">
                  {item.fileName}
                  {item.id === index.activeId ? <span className="ml-2 rounded-full bg-lavender-soft px-2 py-0.5 text-xs">Đang dùng</span> : null}
                </td>
                <td className="px-3 py-2">{formatWhen(item.importedAt)}</td>
                <td className="px-3 py-2">{item.importedBy}</td>
                <td className="px-3 py-2 text-right">{item.rowCount}</td>
                <td className="px-3 py-2 text-right">{formatQty(item.totalQty)}</td>
                <td className="px-3 py-2 text-right">
                  {item.id === index.activeId ? null : (
                    <Button size="sm" variant="outline" onClick={() => void onActivate(item.id)}>Đặt làm dữ liệu đang dùng</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
