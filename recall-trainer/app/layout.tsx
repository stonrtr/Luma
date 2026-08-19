import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { db } from "@/lib/db";

const onest = Onest({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-onest",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recall — база знаний",
  description: "Персональная база знаний с AI: сохраняй, находи и повторяй.",
};

export const viewport: Viewport = {
  themeColor: "#5b57e0",
  width: "device-width",
  initialScale: 1,
};

async function getNavCounts() {
  try {
    const [needReview, dueCards, inbox] = await Promise.all([
      db.source.count({ where: { status: { in: ["DRAFT_READY", "EDITING"] } } }),
      db.card.count({ where: { dueAt: { lte: new Date() } } }),
      db.source.count({ where: { status: { in: ["NEW", "TRANSCRIBING", "ANALYZING", "ERROR"] } } }),
    ]);
    return { needReview, dueCards, inbox };
  } catch {
    return { needReview: 0, dueCards: 0, inbox: 0 };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const counts = await getNavCounts();
  return (
    <html lang="ru" className={onest.variable} suppressHydrationWarning>
      <body>
        <div className="app">
          <Sidebar counts={counts} />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
