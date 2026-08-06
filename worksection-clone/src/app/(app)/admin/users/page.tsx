import { redirect } from "next/navigation";
import { requireUser } from "@/server/dal";
import { getAllUsers } from "@/server/queries/users";
import { NewUserDialog } from "@/components/admin/new-user-dialog";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MEMBER: "Сотрудник",
  CLIENT: "Клиент",
};

const ROLE_STYLE: Record<string, string> = {
  OWNER: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  MEMBER: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  CLIENT: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export default async function AdminUsersPage() {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") redirect("/");

  const users = await getAllUsers();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Пользователи</h1>
          <p className="mt-1 text-sm text-muted-foreground">Управление командой и ролями</p>
        </div>
        <NewUserDialog />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {users.map((u, i) => (
          <div key={u.id} className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t", !u.isActive && "opacity-60")}>
            <Avatar className="size-9"><AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.name}</p>
              <p className="truncate text-xs text-muted-foreground">{u.title ?? u.email}</p>
            </div>
            {!u.isActive && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Неактивний</span>}
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ROLE_STYLE[u.role])}>
              {ROLE_LABEL[u.role]}
            </span>
            <UserRowActions userId={u.id} isActive={u.isActive} canManage={u.id !== user.id && u.role !== "OWNER"} />
          </div>
        ))}
      </div>
    </div>
  );
}
