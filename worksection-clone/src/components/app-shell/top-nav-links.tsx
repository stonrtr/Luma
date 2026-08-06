"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, FolderOpen, Network, UsersRound, BarChart3, Users, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string; color: string };

export function TopNavLinks({ locale, isAdmin, projects }: { locale: string; isAdmin: boolean; projects: Project[] }) {
  const pathname = usePathname();
  const items = [
    { href: "/", key: "nav.myspace", icon: LayoutDashboard },
    { href: "/planning", key: "nav.planning", icon: ClipboardList },
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

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(base, pathname.startsWith("/projects") ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          <FolderOpen className="size-4" />
          <span className="hidden md:inline">{t(locale, "nav.projects")}</span>
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
          {projects.length > 0 && <div className="my-1 border-t" />}
          <Link href="/projects" className="block rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
            {t(locale, "nav.allProjects")}
          </Link>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
