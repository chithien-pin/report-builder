"use client";

import dynamic from "next/dynamic";

const CheckApp = dynamic(
  () => import("@/components/check-stock/CheckApp").then((mod) => mod.CheckApp),
  {
    ssr: false,
    loading: () => <main className="px-4 py-10 text-sm text-muted-foreground">Đang mở phiếu kiểm đếm…</main>,
  },
);

export default function CheckStockPage() {
  return <CheckApp />;
}
