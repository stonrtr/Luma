import type { Metadata } from "next";
// Шрифт бандлится локально (пакет @fontsource-variable/manrope), а не тянется из Google Fonts —
// иначе production-сборка на Turbopack падает в чистом CI (нет доступа к fonts.googleapis.com).
import "@fontsource-variable/manrope";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workspace M",
  description: "Управление проектами, задачами и временем",
  // PWA: иконка и режим «как приложение» для iOS (Добавить на экран «Домой»)
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Workspace M" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        {/* expand — тосты всегда столбиком один над другим, а не «стопкой» с наложением */}
        <Toaster richColors closeButton expand visibleToasts={5} position="bottom-right" />
      </body>
    </html>
  );
}
