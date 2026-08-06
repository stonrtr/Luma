import Link from "next/link";
import { requireAdmin } from "@/server/dal";
import { getUsers } from "@/server/queries/users";
import { NewUserDialog } from "@/components/admin/new-user-dialog";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDateTime } from "@/lib/format";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await getUsers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Команда</h1>
        <NewUserDialog />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Имя</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Роль</th>
              <th className="px-4 py-2 font-medium">Создан</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                    {user.name}
                  </div>
                </td>
                <td className="px-4 py-2">{user.email}</td>
                <td className="px-4 py-2">
                  <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                    {user.role === "ADMIN" ? "Админ" : "Участник"}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {formatDateTime(user.createdAt)}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/team/${user.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Открыть доску →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
