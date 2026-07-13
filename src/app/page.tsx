"use client";

import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { UploadScreen } from "@/components/dashboard/upload-screen";
import { useDashboardStore } from "@/lib/store";

export default function HomePage() {
  const meta = useDashboardStore((s) => s.meta);

  if (!meta) {
    return <UploadScreen />;
  }

  return <DashboardScreen />;
}
