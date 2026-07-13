"use client";

import Link from "next/link";

import { UploadZone } from "@/components/upload/upload-zone";

export function UploadScreen() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <p className="text-sm font-medium uppercase tracking-wide text-bronze">ReportBTMH</p>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard số liệu</h1>
      </header>

      <main className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="w-full max-w-xl">
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Upload CSV/XLSX hoặc Google Sheets — sau đó cấu hình nhóm trong popup.
          </p>
          <UploadZone />
        </div>
      </main>

      <footer className="shrink-0 border-t border-border py-2 text-center text-xs text-muted-foreground">
        File mẫu:{" "}
        <Link href="/sample-data/sales_sample_10k.csv" className="underline">
          sales_sample_10k.csv
        </Link>
      </footer>
    </div>
  );
}
