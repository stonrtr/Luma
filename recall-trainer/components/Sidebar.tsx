"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddFlow } from "./AddFlow";
import { Toaster } from "./ui";

const NAV: { href: string; label: string; ico: string; badge?: "inbox" | "review" }[] = [
  { href: "/", label: "Главная", ico: "🏠" },
  { href: "/inbox", label: "Inbox", ico: "📥", badge: "inbox" },
  { href: "/knowledge", label: "Мои знания", ico: "📚" },
  { href: "/topics", label: "Темы", ico: "🗂" },
  { href: "/sources", label: "Источники", ico: "🎬" },
  { href: "/review", label: "Повторение", ico: "🔁", badge: "review" },
  { href: "/search", label: "Поиск", ico: "🔍" },
  { href: "/ask", label: "Спросить базу", ico: "✨" },
  { href: "/favorites", label: "Избранное", ico: "⭐" },
];

export function Sidebar({
  counts,
}: {
  counts: { needReview: number; dueCards: number; inbox: number };
}) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">R</span>
        Recall
      </div>
      <AddFlow />
      {NAV.map((n) => {
        const badge =
          n.badge === "inbox" ? counts.inbox : n.badge === "review" ? counts.dueCards : 0;
        return (
          <Link key={n.href} href={n.href} className={`nav-link ${isActive(n.href) ? "active" : ""}`}>
            <span className="ico">{n.ico}</span>
            {n.label}
            {badge > 0 && <span className="nav-badge">{badge}</span>}
          </Link>
        );
      })}
      <Toaster />
    </aside>
  );
}
