import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Kiểm đếm hàng hóa",
  description: "Đối chiếu số đếm thực tế với tồn Augges",
};

export default function CheckStockLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background text-foreground [&_button]:[font:inherit] [&_input]:[font:inherit]">
      {children}
    </div>
  );
}
