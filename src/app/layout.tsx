import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "청년 지원금 맞춤 찾기",
  description:
    "나이·지역·소득·상태 4개만 입력하면, 내가 지금 받을 수 있는 청년 지원 정책을 예상 수령액 합계와 마감 D-day로 보여 줍니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111A2C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDemoMode = Boolean(process.env.DEMO_TODAY);

  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg font-sans text-navy antialiased">
        <AppShell isDemoMode={isDemoMode}>{children}</AppShell>
      </body>
    </html>
  );
}
