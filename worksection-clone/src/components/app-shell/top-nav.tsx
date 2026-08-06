import Link from "next/link";
import { NotificationBell } from "./notification-bell";
import { TopNavLinks } from "./top-nav-links";
import { UserMenu } from "./user-menu";

type Notif = { id: string; message: string; link: string | null; readAt: string | null; createdAt: string };

export function TopNav({
  user, notifications,
}: {
  user: { name: string; email: string; title: string | null; role: string; locale: string; avatarUrl: string | null };
  notifications: { items: Notif[]; unread: number };
}) {
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-sidebar px-4 text-sidebar-foreground">
      <Link href="/" className="flex shrink-0 items-baseline text-foreground">
        <span className="text-lg font-medium tracking-tight">team</span>
        <span className="ml-1 text-2xl font-extrabold leading-none tracking-tight">M</span>
      </Link>
      <div className="flex-1 overflow-x-auto">
        <TopNavLinks locale={user.locale} isAdmin={isAdmin} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell items={notifications.items} unread={notifications.unread} />
        <UserMenu name={user.name} title={user.title} email={user.email} avatarUrl={user.avatarUrl} locale={user.locale} />
      </div>
    </header>
  );
}
