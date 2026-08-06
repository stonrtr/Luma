import { requireUser } from "@/server/dal";
import { SettingsForm } from "@/components/settings/settings-form";
import { t } from "@/lib/i18n";

export default async function SettingsPage() {
  const user = await requireUser();

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
          avatarUrl: user.avatarUrl,
          locale: user.locale,
          theme: user.theme,
          timezone: user.timezone,
          weekStartsMon: user.weekStartsMon,
        }}
      />
    </div>
  );
}
