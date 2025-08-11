import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "判决书分析器 - AI驱动的法律文档分析工具",
  description: "专业的法律判决书AI分析工具，支持律师、企业、媒体、公众四种分析模式，提供结构化分析和风险评估。",
  keywords: ["法律分析", "判决书", "AI", "法律科技", "风险评估"],
  authors: [{ name: "Judgment Analyzer Team" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
