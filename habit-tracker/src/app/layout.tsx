import type { Metadata } from "next";
import { Archivo, Space_Mono } from "next/font/google";
import "./globals.css";

const sans = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--sans" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--mono" });

export const metadata: Metadata = {
  title: "Направления жизни",
  description: "Что мне нужно сделать сегодня — и как держатся направления",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
