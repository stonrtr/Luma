import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Вектори — особистий трекер",
  description: "Управление проектами, задачами и временем",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`h-full antialiased ${manrope.variable}`}>
      <body className="min-h-full">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
