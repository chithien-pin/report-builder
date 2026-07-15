"use client";

import { ReportScreen } from "@/components/report/report-screen";
import { UploadScreen } from "@/components/report/upload-screen";
import { useReportStore } from "@/lib/report-store";

export default function HomePage() {
  const datasetId = useReportStore((s) => s.datasetId);

  if (!datasetId) {
    return <UploadScreen />;
  }

  return <ReportScreen />;
}
