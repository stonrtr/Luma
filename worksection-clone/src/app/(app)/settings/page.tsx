import { requireUser } from "@/server/dal";
import { getRecurringForUser } from "@/server/queries/planning";
import { SettingsForm } from "@/components/settings/settings-form";
import { RecurringBlock } from "@/components/planning/recurring-block";
import { t } from "@/lib/i18n";

export default async function SettingsPage() {
  const user = await requireUser();
  const recurring = await getRecurringForUser(user.id);

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

      <section className="mt-6 rounded-xl border bg-card p-5">
        <RecurringBlock
          userId={user.id}
          items={recurring.map((r) => ({ id: r.id, title: r.title, priority: r.priority, frequency: r.frequency, weekdays: r.weekdays, dayOfMonth: r.dayOfMonth }))}
          canEdit
        />
      </section>
    </div>
  );
}
