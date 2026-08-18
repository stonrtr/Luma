import { requireUser } from "@/server/dal";
import { getFiles } from "@/server/queries/files";
import { FilesManager } from "@/components/files/files-manager";

export default async function FilesPage() {
  const user = await requireUser();
  const { files, viewerId, isAdmin } = await getFiles(user.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <FilesManager
        files={files.map((f) => ({ id: f.id, name: f.name, url: f.url, kind: f.kind, ownerId: f.owner.id, ownerName: f.owner.name }))}
        viewerId={viewerId}
        isAdmin={isAdmin}
      />
    </div>
  );
}
