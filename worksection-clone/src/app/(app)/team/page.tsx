import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/dal";
import { getTeamOverview } from "@/server/queries/team";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_DOT, priorityStyle } from "@/lib/domain";
import { initials, formatMinutes, formatShortDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

function LoadBar({ used, cap }: { used: number; cap: number }) {
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const over = used > cap;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", over ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function TeamPage() {
  const viewer = await requireUser();
  if (viewer.role !== "OWNER" && viewer.role !== "ADMIN") redirect("/");

  const { members, tasks } = await getTeamOverview();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Команда</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Задачі всіх співробітників та навантаження</p>

      {/* Нагрузка по людям */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <div key={m.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <Avatar className="size-8"><AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.title ?? "—"}</p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{m.taskCount} задач</span>
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Сьогодні</span><span>{formatMinutes(m.todayMin)} / {formatMinutes(m.dailyCap)}</span>
                </div>
                <LoadBar used={m.todayMin} cap={m.dailyCap} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Тиждень</span><span>{formatMinutes(m.weekMin)} / {formatMinutes(m.weekCap)}</span>
                </div>
                <LoadBar used={m.weekMin} cap={m.weekCap} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Доска всех задач по статусам */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TASK_STATUSES.filter((s) => s !== "DONE").map((status) => {
          const rows = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="flex w-72 shrink-0 flex-col">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={cn("size-2.5 rounded-full", TASK_STATUS_DOT[status])} />
                <span className="text-sm font-medium">{TASK_STATUS_LABEL[status]}</span>
                <span className="text-xs text-muted-foreground">{rows.length}</span>
              </div>
              <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-2">
                {rows.map((t) => (
                  <Link key={t.id} href={`/tasks/${t.id}`} className={cn("rounded-lg border bg-card p-3 shadow-sm hover:shadow-md", t.assignedByManager && "border-l-4 border-l-primary")}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-snug">{t.title}</span>
                      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold", priorityStyle(t.priority))}>{t.priority}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {t.project && <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ backgroundColor: t.project.color }} />{t.project.name}</span>}
                        {t.dueDate && <span className={cn(isOverdue(t.dueDate) && "text-destructive")}>{formatShortDate(t.dueDate)}</span>}
                      </div>
                      <div className="flex -space-x-1.5">
                        {t.assignees.map((a) => (
                          <Avatar key={a.user.id} className="size-6 border-2 border-card" title={a.user.name}>
                            <AvatarFallback className="text-[9px]">{initials(a.user.name)}</AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
                {rows.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Порожньо</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
