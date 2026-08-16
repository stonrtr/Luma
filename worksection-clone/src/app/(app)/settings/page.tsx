import { requireUser } from "@/server/dal";
import { SettingsForm } from "@/components/settings/settings-form";
import { GoogleCalendarCard } from "@/components/settings/google-calendar-card";
import { TelegramCard } from "@/components/settings/telegram-card";
import { isTelegramConfigured } from "@/server/telegram/api";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { db } from "@/server/db";
import { isGoogleConfigured } from "@/server/google/oauth";
import { t } from "@/lib/i18n";

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";
  const googleAcc = await db.googleAccount.findUnique({ where: { userId: user.id }, select: { googleEmail: true } });
  const tgAcc = await db.telegramAccount.findUnique({ where: { userId: user.id }, select: { username: true } });

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

      {isAdmin && (
        <Link href="/admin/notifications" className="mt-6 flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 transition-colors hover:bg-accent/40">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Bell className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t(user.locale, "nset.hubTitle")}</span>
            <span className="block text-xs text-muted-foreground">{t(user.locale, "nset.hubSub")}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <TelegramCard configured={isTelegramConfigured()} connected={!!tgAcc} username={tgAcc?.username ?? null} />

      <GoogleCalendarCard configured={isGoogleConfigured()} connected={!!googleAcc} email={googleAcc?.googleEmail ?? null} />
    </div>
  );
}
