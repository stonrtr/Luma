import { requireUser } from "@/server/dal";
import { getFiles } from "@/server/queries/files";
import { FilesManager } from "@/components/files/files-manager";

export default async function FilesPage() {
  const user = await requireUser();
  const { team, own, shared, users, driveFolderUrl } = await getFiles(user.id);
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <FilesManager
        team={team.map((f) => ({ id: f.id, name: f.name, url: f.url, kind: f.kind, owner: f.owner }))}
        own={own.map((f) => ({ id: f.id, name: f.name, url: f.url, kind: f.kind, note: f.note, shares: f.shares.map((s) => ({ user: s.user })) }))}
        shared={shared.map((f) => ({ id: f.id, name: f.name, url: f.url, kind: f.kind, owner: f.owner }))}
        users={users}
        driveFolderUrl={driveFolderUrl}
        isAdmin={isAdmin}
      />
    </div>
  );
}
