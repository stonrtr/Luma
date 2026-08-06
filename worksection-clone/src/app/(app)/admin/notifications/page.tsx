import { redirect } from "next/navigation";
import { requireUser } from "@/server/dal";
import { getNotificationSettings } from "@/server/queries/notification-settings";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { NotificationSettingsForm } from "@/components/admin/notification-settings-form";

export default async function AdminNotificationsPage() {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") redirect("/");
  const settings = await getNotificationSettings();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Сповіщення</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Які сповіщення надсилати співробітникам</p>
      <AdminTabs />
      <NotificationSettingsForm settings={settings} />
    </div>
  );
}
