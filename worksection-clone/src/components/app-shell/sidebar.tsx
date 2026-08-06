import Link from "next/link";
import { LayoutDashboard, Plus, Calendar, BarChart3, Users, ClipboardList, Network, UsersRound, FolderOpen, Settings } from "lucide-react";
import { SignOutButton } from "./sign-out-button";
import { NotificationBell } from "./notification-bell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";

type SidebarProject = { id: string; name: string; color: string };
type Notif = { id: string; message: string; link: string | null; readAt: string | null; createdAt: string };

export function Sidebar({
  user,
  projects,
  notifications,
}: {
  user: { name: string; email: string; title: string | null; role: string; locale: string; avatarUrl: string | null };
  projects: SidebarProject[];
  notifications: { items: Notif[]; unread: number };
}) {
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";
  const tr = (k: string) => t(user.locale, k);
  const item = "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted";
  const icon = "size-4 text-muted-foreground";

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">W</div>
        <span className="font-semibold">Worksection</span>
        <div className="ml-auto">
          <NotificationBell items={notifications.items} unread={notifications.unread} />
        </div>
      </div>

      <nav className="space-y-0.5 px-2">
        <Link href="/" className={item}><LayoutDashboard className={icon} />{tr("nav.myspace")}</Link>
        <Link href="/planning" className={item}><ClipboardList className={icon} />{tr("nav.planning")}</Link>
        <Link href="/calendar" className={item}><Calendar className={icon} />{tr("nav.calendar")}</Link>
        <Link href="/files" className={item}><FolderOpen className={icon} />{tr("nav.files")}</Link>
        <Link href="/org" className={item}><Network className={icon} />{tr("nav.org")}</Link>
        {isAdmin && <Link href="/team" className={item}><UsersRound className={icon} />{tr("nav.team")}</Link>}
        <Link href="/reports" className={item}><BarChart3 className={icon} />{tr("nav.reports")}</Link>
        {isAdmin && <Link href="/admin/users" className={item}><Users className={icon} />{tr("nav.users")}</Link>}
      </nav>

      <div className="mt-4 flex items-center justify-between px-4">
        <Link href="/projects" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
          {tr("nav.projects")}
        </Link>
        <Link href="/projects" className="text-muted-foreground hover:text-foreground" title={tr("nav.allProjects")}>
          <Plus className="size-4" />
        </Link>
      </div>

      <div className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-2">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
      </div>

      <div className="border-t p-3">
        <Link href="/settings" className="mb-2 flex items-center gap-2 rounded-md p-1 hover:bg-muted">
          <Avatar className="size-8">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.title ?? user.email}</p>
          </div>
          <Settings className="size-4 text-muted-foreground" />
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}
