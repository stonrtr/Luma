import Link from "next/link";
import { LayoutDashboard, Plus, Calendar, BarChart3, Users } from "lucide-react";
import { SignOutButton } from "./sign-out-button";
import { NotificationBell } from "./notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

type SidebarProject = { id: string; name: string; color: string };
type Notif = { id: string; message: string; link: string | null; readAt: string | null; createdAt: string };

export function Sidebar({
  user,
  projects,
  notifications,
}: {
  user: { name: string; email: string; title: string | null; role: string };
  projects: SidebarProject[];
  notifications: { items: Notif[]; unread: number };
}) {
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          W
        </div>
        <span className="font-semibold">Worksection</span>
        <div className="ml-auto">
          <NotificationBell items={notifications.items} unread={notifications.unread} />
        </div>
      </div>

      <nav className="space-y-0.5 px-2">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <LayoutDashboard className="size-4 text-muted-foreground" />
          Обзор
        </Link>
        <Link
          href="/calendar"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Calendar className="size-4 text-muted-foreground" />
          Календарь
        </Link>
        <Link
          href="/reports"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <BarChart3 className="size-4 text-muted-foreground" />
          Отчёты
        </Link>
        {isAdmin && (
          <Link
            href="/admin/users"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Users className="size-4 text-muted-foreground" />
            Пользователи
          </Link>
        )}
      </nav>

      <div className="mt-4 flex items-center justify-between px-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Проекты
        </span>
        <Link href="/?new=1" className="text-muted-foreground hover:text-foreground" title="Новый проект">
          <Plus className="size-4" />
        </Link>
      </div>

      <div className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
        {projects.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Пока нет проектов</p>
        )}
      </div>

      <div className="border-t p-3">
        <div className="mb-2 flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.title ?? user.email}</p>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
