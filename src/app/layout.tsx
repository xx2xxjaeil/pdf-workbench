import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Workbench — 브라우저 PDF 편집기",
  description:
    "PDF를 열고 텍스트, 표, 이미지를 추가한 뒤 다시 PDF로 저장하세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
