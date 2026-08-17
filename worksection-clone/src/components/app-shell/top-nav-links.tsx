"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutDashboard, ClipboardList, FolderOpen, Network, UsersRound, FolderKanban, PhoneCall, Table2, Menu, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function TopNavLinks({ locale, isAdmin }: { locale: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = [
    { href: "/", key: "nav.myspace", icon: LayoutDashboard },
    // Команда — вторым пунктом (только руководителям)
    ...(isAdmin ? [{ href: "/team", key: "nav.team", icon: UsersRound }] : []),
    { href: "/planning", key: "nav.planning", icon: ClipboardList },
    // Звонки — 4-м пунктом (после Планирования)
    { href: "/calls", key: "nav.calls", icon: PhoneCall },
    { href: "/projects", key: "nav.projects", icon: FolderKanban },
    { href: "/files", key: "nav.files", icon: FolderOpen },
    { href: "/sheets", key: "nav.sheets", icon: Table2 },
    // Оргсхема — только для руководителей (OWNER/ADMIN)
    ...(isAdmin ? [{ href: "/org", key: "nav.org", icon: Network }] : []),
    // «Отчёты» скрыты из навигации, пока не решён сценарий использования (роут /reports жив)
    // { href: "/reports", key: "nav.reports", icon: BarChart3 },
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const base = "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors";

  // Мобильное меню-бургер. Портал в body: у хедера backdrop-filter, из-за него
  // fixed-потомки позиционируются относительно хедера, а не окна.
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]); // переход по ссылке закрывает меню

  // Звук-«щелчок» при переключении вкладки (клик по гесту — autoplay разрешён)
  const playSwitch = () => {
    try { const a = new Audio("/tab-switch.mp3"); a.volume = 0.5; a.play().catch(() => {}); } catch { /* звук необязателен */ }
  };

  // Быстрые переходы: цифра 1..9 открывает вкладку по её порядку в хедере.
  // Игнорируем ввод в полях и модификаторы (Cmd+1 и т.п.).
  const hrefs = items.map((it) => it.href);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (el?.closest?.("[data-sheet-editor]") || document.querySelector("[data-sheet-editor]")) return; // не мешаем таблице
      if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        if (idx < hrefs.length && hrefs[idx] !== pathname) { e.preventDefault(); playSwitch(); router.push(hrefs[idx]); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hrefs.join("|"), router]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* планшет/десктоп: горизонтальная лента */}
      <nav className="hidden items-center gap-0.5 md:flex">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.href} href={it.href} onClick={() => { if (!isActive(it.href)) playSwitch(); }} className={cn(base, isActive(it.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <Icon className="size-4" />
              <span>{t(locale, it.key)}</span>
            </Link>
          );
        })}
      </nav>

      {/* мобильный: бургер + выпадающая панель с названиями разделов */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
        aria-label="Menu"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {mounted && open && createPortal(
        <div className="fixed inset-0 top-14 z-50 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <nav
            className="relative border-b bg-popover py-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => { if (!isActive(it.href)) playSwitch(); setOpen(false); }}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium",
                    isActive(it.href) ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-4.5" />
                  {t(locale, it.key)}
                </Link>
              );
            })}
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}
