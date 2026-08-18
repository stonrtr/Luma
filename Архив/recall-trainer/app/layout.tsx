import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recall — база знаний с тренировкой памяти",
  description:
    "Личная база знаний: загружайте темы конспектами, а Recall составляет вопросы и напоминает повторить их по интервалам, чтобы не забыть.",
};

export const viewport: Viewport = {
  themeColor: "#4255ff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
