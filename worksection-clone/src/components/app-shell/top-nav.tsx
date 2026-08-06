import Link from "next/link";
import { NotificationBell } from "./notification-bell";
import { TopNavLinks } from "./top-nav-links";
import { UserMenu } from "./user-menu";

type Project = { id: string; name: string; color: string };
type Notif = { id: string; message: string; link: string | null; readAt: string | null; createdAt: string };

export function TopNav({
  user, projects, notifications,
}: {
  user: { name: string; email: string; title: string | null; role: string; locale: string; avatarUrl: string | null };
  projects: Project[];
  notifications: { items: Notif[]; unread: number };
}) {
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-sidebar px-4 text-sidebar-foreground">
      <Link href="/" className="flex shrink-0 items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">W</div>
        <span className="hidden font-semibold sm:inline">Worksection</span>
      </Link>
      <div className="flex-1 overflow-x-auto">
        <TopNavLinks locale={user.locale} isAdmin={isAdmin} projects={projects} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell items={notifications.items} unread={notifications.unread} />
        <UserMenu name={user.name} title={user.title} email={user.email} avatarUrl={user.avatarUrl} locale={user.locale} />
      </div>
    </header>
  );
}
