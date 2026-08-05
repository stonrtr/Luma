import { requireUser } from "@/server/dal";
import { getProjectsForUser } from "@/server/queries/projects";
import { getNotifications } from "@/server/queries/notifications";
import { Sidebar } from "@/components/app-shell/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [projects, notifications] = await Promise.all([
    getProjectsForUser(user.id),
    getNotifications(user.id),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={{ name: user.name, email: user.email, title: user.title, role: user.role }}
        projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
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
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
