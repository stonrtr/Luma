import { requireUser } from "@/server/dal";
import { getUser } from "@/server/queries/users";
import { AvatarForm } from "@/components/settings/avatar-form";

export default async function SettingsPage() {
  const session = await requireUser();
  const me = await getUser(session.id);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-semibold">Настройки профиля</h1>
      <AvatarForm
        name={me?.name ?? session.name ?? ""}
        avatarUrl={me?.avatarUrl ?? null}
      />
    </div>
  );
}
