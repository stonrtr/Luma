import { requireUser } from "@/server/dal";
import { getOrgUsers } from "@/server/queries/team";
import { OrgEditDialog } from "@/components/org/org-edit-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = { OWNER: "Власник", ADMIN: "Адміністратор", MEMBER: "Співробітник" };

type OrgUser = Awaited<ReturnType<typeof getOrgUsers>>[number];

export default async function OrgPage() {
  const viewer = await requireUser();
  const users = await getOrgUsers();
  const isAdmin = viewer.role === "OWNER" || viewer.role === "ADMIN";
  const candidates = users.map((u) => ({ id: u.id, name: u.name }));

  const byManager = new Map<string | null, OrgUser[]>();
  for (const u of users) {
    const key = u.managerId && users.some((x) => x.id === u.managerId) ? u.managerId : null;
    const arr = byManager.get(key) ?? [];
    arr.push(u);
    byManager.set(key, arr);
  }

  function Node({ user, depth }: { user: OrgUser; depth: number }) {
    const reports = byManager.get(user.id) ?? [];
    const canEdit = isAdmin || user.managerId === viewer.id;
    return (
      <div className={cn(depth > 0 && "ml-6 border-l pl-6")}>
        <div className="mb-3 rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <Avatar className="size-10"><AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{user.name}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{ROLE_LABEL[user.role] ?? user.role}</span>
                {!user.isActive && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">Неактивний</span>}
                {canEdit && <span className="ml-auto"><OrgEditDialog user={user} candidates={candidates} isAdmin={isAdmin} /></span>}
              </div>
              <p className="text-sm text-muted-foreground">{user.title ?? "Посада не вказана"}</p>
              {user.functions && <p className="mt-1.5 text-sm">{user.functions}</p>}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {user.weeklyHours != null ? `${user.weeklyHours} год/тиждень${user.weeklyHours < 40 ? " · неповний день" : ""}` : "Години не вказані"}
              </p>
            </div>
          </div>
        </div>
        {reports.map((r) => <Node key={r.id} user={r} depth={depth + 1} />)}
      </div>
    );
  }

  const roots = byManager.get(null) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Оргсхема</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Структура команди, функції та робочі години</p>
      {roots.map((u) => <Node key={u.id} user={u} depth={0} />)}
    </div>
  );
}
