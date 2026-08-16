import { requireUser } from "@/server/dal";
import { t } from "@/lib/i18n";
import { getCallContacts, getArchivedCallContacts } from "@/server/queries/calls";
import { CallContactsPanel } from "@/components/calls/call-contacts-panel";
import { UsersRound } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const user = await requireUser();
  const [contacts, archivedContacts] = await Promise.all([
    getCallContacts(user.id),
    getArchivedCallContacts(user.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t(user.locale, "calls.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(user.locale, "calls.subtitle")}</p>

      <section className="mt-6">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <UsersRound className="size-4 text-accent-foreground" /> {t(user.locale, "calls.contactsHeader")}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">{t(user.locale, "calls.contactsHint")}</p>
        <CallContactsPanel contacts={contacts} archivedContacts={archivedContacts} locale={user.locale} />
      </section>
    </div>
  );
}
