import Link from "next/link";
import { NotificationBell } from "./notification-bell";
import { TopNavLinks } from "./top-nav-links";
import { UserMenu } from "./user-menu";
import { GlobalSearch } from "./global-search";
import { Scratchpad } from "./scratchpad";
import { HelpDialog } from "./help-dialog";

type Notif = { id: string; message: string; link: string | null; readAt: string | null; createdAt: string };

export function TopNav({
  user, notifications, noteBody, isManager = false,
}: {
  user: { name: string; email: string; title: string | null; role: string; locale: string; avatarUrl: string | null };
  notifications: { items: Notif[]; unread: number };
  noteBody: string;
  isManager?: boolean;
}) {
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-sidebar px-4 text-sidebar-foreground dark:border-[rgba(198,232,155,0.10)] dark:bg-[rgba(10,19,13,0.55)] dark:backdrop-blur-md">
      <Link href="/" className="flex shrink-0 items-center gap-2 text-foreground">
        <span
          className="size-8 rounded-lg bg-white bg-contain bg-center bg-no-repeat shadow-sm ring-1 ring-black/5"
          style={{ backgroundImage: "url('/logo.png')" }}
          role="img"
          aria-label="Workspace M"
        />
        <span className="hidden text-lg font-medium tracking-tight sm:block">Workspace <span className="font-extrabold">M</span></span>
      </Link>
      <Scratchpad initialBody={noteBody} />
      <div className="nav-scroll flex-1">
        <TopNavLinks locale={user.locale} isAdmin={isAdmin} isManager={isManager} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <GlobalSearch />
        <HelpDialog locale={user.locale} />
        <NotificationBell items={notifications.items} unread={notifications.unread} />
        <UserMenu name={user.name} title={user.title} email={user.email} avatarUrl={user.avatarUrl} locale={user.locale} />
      </div>
    </header>
  );
}
