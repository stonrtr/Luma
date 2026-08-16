import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/dal";
import { getNotificationSettings } from "@/server/queries/notification-settings";
import { NotificationHub } from "@/components/admin/notification-hub";
import { t } from "@/lib/i18n";

export default async function AdminNotificationsPage() {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") redirect("/");
  const settings = await getNotificationSettings();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent-foreground">
        <ArrowLeft className="size-3.5" /> {t(user.locale, "settings.title")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t(user.locale, "nset.hubTitle")}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{t(user.locale, "nset.hubSub")}</p>
      <NotificationHub settings={settings} />
    </div>
  );
}
