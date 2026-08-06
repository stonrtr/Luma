import { requireUser } from "@/server/dal";
import { getFiles } from "@/server/queries/files";
import { FilesManager } from "@/components/files/files-manager";
import { t } from "@/lib/i18n";

export default async function FilesPage() {
  const user = await requireUser();
  const { own, shared, users } = await getFiles(user.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t(user.locale, "nav.files")}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Документи, посилання та спільні матеріали</p>
      <FilesManager
        own={own.map((f) => ({ id: f.id, name: f.name, url: f.url, kind: f.kind, note: f.note, shares: f.shares.map((s) => ({ user: s.user })) }))}
        shared={shared.map((f) => ({ id: f.id, name: f.name, url: f.url, kind: f.kind, owner: f.owner }))}
        users={users}
      />
    </div>
  );
}
