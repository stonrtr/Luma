"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, FolderOpen, Network, UsersRound, BarChart3, Users, FolderKanban } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function TopNavLinks({ locale, isAdmin }: { locale: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/", key: "nav.myspace", icon: LayoutDashboard },
    { href: "/planning", key: "nav.planning", icon: ClipboardList },
    { href: "/projects", key: "nav.projects", icon: FolderKanban },
    { href: "/files", key: "nav.files", icon: FolderOpen },
    { href: "/org", key: "nav.org", icon: Network },
    ...(isAdmin ? [{ href: "/team", key: "nav.team", icon: UsersRound }] : []),
    { href: "/reports", key: "nav.reports", icon: BarChart3 },
    ...(isAdmin ? [{ href: "/admin/users", key: "nav.users", icon: Users }] : []),
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const base = "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors";

  return (
    <nav className="flex items-center gap-0.5">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Link key={it.href} href={it.href} className={cn(base, isActive(it.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <Icon className="size-4" />
            <span className="hidden md:inline">{t(locale, it.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
