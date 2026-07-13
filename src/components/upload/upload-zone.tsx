"use client";

import { useCallback, useState } from "react";
import { FileSpreadsheet, Link2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importGoogleSheet, uploadFile } from "@/lib/api-client";
import { useDashboardStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onSuccess?: () => void;
}

export function UploadZone({ onSuccess }: UploadZoneProps) {
  const setUploadResult = useDashboardStore((s) => s.setUploadResult);
  const [dragging, setDragging] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const result = await uploadFile(file);
        setUploadResult(result.dataset_id, result.meta, result.preview);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload thất bại");
      } finally {
        setLoading(false);
      }
    },
    [onSuccess, setUploadResult],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onImportSheet = async () => {
    if (!sheetUrl.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await importGoogleSheet(sheetUrl.trim());
      setUploadResult(result.dataset_id, result.meta, result.preview);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import Google Sheets thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 transition-colors",
          dragging ? "border-primary bg-accent/60" : "border-border bg-card/50",
        )}
      >
        <Upload className="mb-4 h-10 w-10 text-bronze" />
        <p className="mb-1 text-lg font-medium">Kéo thả CSV hoặc XLSX</p>
        <p className="mb-6 text-sm text-muted-foreground">Hoặc chọn file từ máy tính</p>
        <label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button type="button" variant="outline" disabled={loading} asChild>
            <span>
              <FileSpreadsheet className="h-4 w-4" />
              Chọn file
            </span>
          </Button>
        </label>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Link2 className="h-4 w-4 text-bronze" />
          Google Sheets (public link)
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            disabled={loading}
          />
          <Button onClick={onImportSheet} disabled={loading || !sheetUrl.trim()} className="shrink-0">
            Import
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Sheet cần quyền &quot;Anyone with the link can view&quot;. App sẽ tải qua CSV export.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {loading && <p className="text-center text-sm text-muted-foreground">Đang xử lý dữ liệu...</p>}
    </div>
  );
}
