import { requireUser } from "@/server/dal";
import { SettingsForm } from "@/components/settings/settings-form";
import { GoogleCalendarCard } from "@/components/settings/google-calendar-card";
import { TelegramCard } from "@/components/settings/telegram-card";
import { isTelegramConfigured } from "@/server/telegram/api";
import { NotificationSettingsForm } from "@/components/admin/notification-settings-form";
import { getNotificationSettings } from "@/server/queries/notification-settings";
import { db } from "@/server/db";
import { isGoogleConfigured } from "@/server/google/oauth";
import { t } from "@/lib/i18n";

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";
  const googleAcc = await db.googleAccount.findUnique({ where: { userId: user.id }, select: { googleEmail: true } });
  const tgAcc = await db.telegramAccount.findUnique({ where: { userId: user.id }, select: { username: true } });
  const notificationSettings = isAdmin ? await getNotificationSettings() : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t(user.locale, "settings.title")}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{t(user.locale, "settings.subtitle")}</p>
      <SettingsForm
        initial={{
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          name: user.name,
          email: user.email,
          title: user.title,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          locale: user.locale,
          theme: user.theme,
          timezone: user.timezone,
          weekStartsMon: user.weekStartsMon,
        }}
      />

      {notificationSettings && (
        <section className="mt-6">
          <h2 className="mb-1 text-sm font-semibold">{t(user.locale, "settings.notifTitle")}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{t(user.locale, "settings.notifSub")}</p>
          <NotificationSettingsForm settings={notificationSettings} />
        </section>
      )}

      <TelegramCard configured={isTelegramConfigured()} connected={!!tgAcc} username={tgAcc?.username ?? null} />

      <GoogleCalendarCard configured={isGoogleConfigured()} connected={!!googleAcc} email={googleAcc?.googleEmail ?? null} />
    </div>
  );
}
