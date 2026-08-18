import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Quizlet — Learn with flashcards, games, and AI tools",
  description:
    "Create and study flashcards, then master them with Learn, Test, Match, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <StoreProvider>
          <Navbar />
          <main className="min-h-[calc(100vh-56px)]">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
