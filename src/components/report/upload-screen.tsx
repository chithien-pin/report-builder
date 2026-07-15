"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, Target, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchSavedTarget, uploadReportFiles, uploadTargetFile } from "@/lib/report-api";
import { useReportStore } from "@/lib/report-store";
import { cn } from "@/lib/utils";

function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

function FileDrop({
  label,
  hint,
  accept,
  file,
  onFile,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
  icon: typeof Upload;
  tone?: "primary" | "coral";
}) {
  const [dragging, setDragging] = useState(false);
  const iconBg = tone === "coral" ? "bg-coral-soft text-coral" : "bg-lavender-soft text-primary";

  return (
    <label
      className={cn(
        "soft-card flex cursor-pointer flex-col items-center gap-3 px-6 py-10 text-center transition-all",
        dragging ? "ring-2 ring-primary/40" : "hover:ring-2 hover:ring-lavender",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <span className={cn("flex h-14 w-14 items-center justify-center rounded-full", iconBg)}>
        <Icon className="h-7 w-7" />
      </span>
      <div>
        <p className="text-base font-medium text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      {file ? (
        <p className="max-w-full truncate rounded-full bg-lavender-soft px-4 py-1.5 text-sm font-medium text-primary">
          {file.name}
        </p>
      ) : (
        <span className="text-xs text-muted-foreground">Kéo thả hoặc chọn file</span>
      )}
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export function UploadScreen() {
  const setUploadResult = useReportStore((s) => s.setUploadResult);
  const setSavedTarget = useReportStore((s) => s.setSavedTarget);
  const savedTarget = useReportStore((s) => s.savedTarget);

  const [sales, setSales] = useState<File | null>(null);
  const [target, setTarget] = useState<File | null>(null);
  const [replaceTarget, setReplaceTarget] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchSavedTarget()
      .then((t) => setSavedTarget(t))
      .catch(() => {});
  }, [setSavedTarget]);

  const hasSavedTarget = Boolean(savedTarget);
  const needTargetFile = !hasSavedTarget || replaceTarget;
  const canSubmit = Boolean(sales) && (!needTargetFile || Boolean(target));

  const submit = useCallback(async () => {
    if (!sales) {
      setError("Cần file doanh số");
      return;
    }
    if (needTargetFile && !target) {
      setError("Cần file chỉ tiêu");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await uploadReportFiles(sales, needTargetFile ? target : null);
      setUploadResult(res.datasetId, res.meta, res.groupConfig, res.savedTarget);
      if (res.savedTarget) setSavedTarget(res.savedTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload thất bại");
    } finally {
      setLoading(false);
    }
  }, [sales, target, needTargetFile, setUploadResult, setSavedTarget]);

  const saveTargetOnly = useCallback(async () => {
    if (!target) {
      setError("Chọn file chỉ tiêu mới");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await uploadTargetFile(target);
      setSavedTarget(res.savedTarget);
      setReplaceTarget(false);
      setTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu chỉ tiêu thất bại");
    } finally {
      setLoading(false);
    }
  }, [target, setSavedTarget]);

  return (
    <div className="flex h-dvh flex-col overflow-auto bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-12">
        <p className="text-sm font-medium text-primary">ReportBTMH</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Báo cáo ngày
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Upload doanh số mỗi lần làm báo cáo. File chỉ tiêu được lưu lại và chỉ đổi khi bạn upload
          mới.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <FileDrop
            label="Doanh số"
            hint="File export bán hàng (có Ngay, Dòng sản phẩm, Thành tiền)"
            accept=".xlsx,.xls,.csv"
            file={sales}
            onFile={setSales}
            icon={FileSpreadsheet}
            tone="primary"
          />

          {needTargetFile ? (
            <div className="flex flex-col gap-3">
              <FileDrop
                label={hasSavedTarget ? "Chỉ tiêu mới" : "Chỉ tiêu"}
                hint="File target tháng (có hàng TỔNG) — sẽ được lưu lại"
                accept=".csv,.xlsx,.xls"
                file={target}
                onFile={setTarget}
                icon={Target}
                tone="coral"
              />
              {hasSavedTarget && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplaceTarget(false);
                    setTarget(null);
                  }}
                >
                  Giữ file đang lưu ({savedTarget?.filename})
                </Button>
              )}
            </div>
          ) : (
            <div className="soft-card flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-coral-soft text-coral">
                <Target className="h-7 w-7" />
              </span>
              <div>
                <p className="font-medium text-foreground">Chỉ tiêu đã lưu</p>
                <p className="mt-1 max-w-full truncate text-sm font-medium text-primary">
                  {savedTarget?.filename}
                </p>
                {savedTarget?.updatedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cập nhật: {formatUpdatedAt(savedTarget.updatedAt)}
                  </p>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setReplaceTarget(true)}>
                Đổi file chỉ tiêu
              </Button>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" disabled={!canSubmit || loading} onClick={submit}>
            <Upload className="h-4 w-4" />
            {loading ? "Đang xử lý…" : "Tạo báo cáo"}
          </Button>
          {needTargetFile && hasSavedTarget && target && (
            <Button size="lg" variant="outline" disabled={loading} onClick={saveTargetOnly}>
              Chỉ lưu chỉ tiêu
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
