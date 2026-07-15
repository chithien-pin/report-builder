import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "ReportBTMH — Báo cáo ngày",
  description: "Dashboard báo cáo ngày: doanh số & sản lượng theo nhóm sản phẩm",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${roboto.variable} h-dvh overflow-hidden font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
