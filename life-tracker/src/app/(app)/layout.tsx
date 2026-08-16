import { requireUser } from "@/server/dal";
import { getProjectsForUser } from "@/server/queries/projects";
import { getAssignableMembers } from "@/server/queries/team";
import { getNotifications } from "@/server/queries/notifications";
import { generateDueRecurringTasks } from "@/server/recurring-engine";
import { runLifecycleMaintenance } from "@/server/lifecycle-engine";
import { TopNav } from "@/components/app-shell/top-nav";
import { NotificationToaster } from "@/components/app-shell/notification-toaster";
import { QuickAddFab } from "@/components/workspace/quick-add-fab";
import { ThemeSync } from "@/components/app-shell/theme-sync";
import { LocaleProvider } from "@/lib/locale-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // фоновое обслуживание: регулярные задачи + автоархив завершённых
  await generateDueRecurringTasks();
  await runLifecycleMaintenance(user.id);
  const [projects, notifications, assignable] = await Promise.all([
    getProjectsForUser(user.id),
    getNotifications(user.id),
    getAssignableMembers(user.id, user.role),
  ]);

  return (
    <LocaleProvider locale={user.locale}>
    <ThemeSync theme={user.theme} />
    <div className={`app-shell flex min-h-screen flex-col ${user.theme === "dark" ? "dark" : ""}`}>
      <TopNav
        user={{ name: user.name, email: user.email, title: user.title, role: user.role, locale: user.locale, avatarUrl: user.avatarUrl }}
        notifications={{
          items: notifications.items.map((n) => ({
            id: n.id,
            message: n.message,
            link: n.link,
            readAt: n.readAt ? n.readAt.toISOString() : null,
            createdAt: n.createdAt.toISOString(),
          })),
          unread: notifications.unread,
        }}
      />
      <main className="flex-1">{children}</main>
      <QuickAddFab userId={user.id} projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))} members={assignable} locale={user.locale} />
      <NotificationToaster
        items={notifications.items.map((n) => ({ id: n.id, type: n.type, message: n.message, link: n.link, readAt: n.readAt ? n.readAt.toISOString() : null }))}
      />
    </div>
    </LocaleProvider>
  );
}
