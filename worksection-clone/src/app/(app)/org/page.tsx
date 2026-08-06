import { requireUser } from "@/server/dal";
import { getOrgUsers } from "@/server/queries/team";
import { OrgEditDialog } from "@/components/org/org-edit-dialog";
import { OrgAddDialog } from "@/components/org/org-add-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

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

  function Node({ user }: { user: OrgUser }) {
    const reports = byManager.get(user.id) ?? [];
    const canEdit = isAdmin || user.managerId === viewer.id;
    return (
      <li>
        <div className="orgcard inline-flex w-56 flex-col rounded-xl border bg-card p-3 text-left align-top shadow-sm">
          <div className="flex items-start gap-2">
            <Avatar className="size-9"><AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{user.name}</span>
                {canEdit && (
                  <span className="ml-auto shrink-0">
                    <OrgEditDialog user={user} candidates={candidates} isAdmin={isAdmin} canDelete={isAdmin && user.role !== "OWNER" && user.id !== viewer.id} />
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{user.title ?? "Посада не вказана"}</p>
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{ROLE_LABEL[user.role] ?? user.role}</span>
            {!user.isActive && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">Неактивний</span>}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {user.weeklyHours != null ? `${Math.round((user.weeklyHours / 5) * 10) / 10} год/день` : "—"}
            </span>
          </div>
          {user.functions && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{user.functions}</p>}
        </div>
        {reports.length > 0 && (
          <ul>
            {reports.map((r) => <Node key={r.id} user={r} />)}
          </ul>
        )}
      </li>
    );
  }

  const roots = byManager.get(null) ?? [];

  return (
    <div className="mx-auto max-w-full px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Оргсхема</h1>
          <p className="mt-1 text-sm text-muted-foreground">Структура команди, функції та робочі години</p>
        </div>
        {isAdmin && <OrgAddDialog candidates={candidates} />}
      </div>

      <div className="overflow-x-auto pb-6">
        <ul className="orgtree w-max min-w-full">
          {roots.map((u) => <Node key={u.id} user={u} />)}
        </ul>
      </div>

      {/* Соединительные линии дерева (сверху вниз, ветвление вширь) */}
      <style>{`
        .orgtree, .orgtree ul { display: flex; justify-content: center; list-style: none; margin: 0; padding: 0; }
        .orgtree > li { padding-top: 0; }
        .orgtree li { position: relative; display: flex; flex-direction: column; align-items: center; padding: 24px 14px 0; }
        .orgtree ul { position: relative; }
        /* горизонтальные соединители между детьми */
        .orgtree ul li::before, .orgtree ul li::after {
          content: ""; position: absolute; top: 0; width: 50%; height: 24px;
          border-top: 2px solid var(--border);
        }
        .orgtree ul li::before { right: 50%; }
        .orgtree ul li::after  { left: 50%; border-left: 2px solid var(--border); }
        /* единственный ребёнок — только вертикаль, без «уголков» */
        .orgtree ul li:only-child::before, .orgtree ul li:only-child::after { display: none; }
        /* обрезаем внешние края у крайних детей */
        .orgtree ul li:first-child::before, .orgtree ul li:last-child::after { border: 0 none; }
        .orgtree ul li:last-child::before { border-right: 2px solid var(--border); }
        /* вертикальный «стебель» от родителя к группе детей */
        .orgtree ul::before {
          content: ""; position: absolute; top: -24px; left: 50%;
          height: 24px; border-left: 2px solid var(--border);
        }
      `}</style>
    </div>
  );
}
