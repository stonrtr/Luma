import Link from "next/link";
import { requireUser } from "@/server/dal";
import { getPlanning, getPlanningTargets, ensureMonthlyKpis, getKpiArchive, getPlanArchive } from "@/server/queries/planning";
import { getMyTasks } from "@/server/queries/tasks";
import { KpiBlock } from "@/components/planning/kpi-block";
import { WeeklyPlan } from "@/components/planning/weekly-plan";
import { db } from "@/server/db";
import { Gauge, ListChecks } from "lucide-react";
import { monthLabel, weekLabel, isoWeekNumber } from "@/lib/week";
import { priorityStyle } from "@/lib/domain";
import { cn } from "@/lib/utils";

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const targets = await getPlanningTargets(viewer.id, viewer.role);

  const targetId = sp.user && targets.some((t) => t.id === sp.user) ? sp.user : viewer.id;
  // авто-KPI: если на этот месяц целей нет — переносим из прошлого
  await ensureMonthlyKpis(targetId);
  const [plan, myTasks, kpiArchive, planArchive] = await Promise.all([
    getPlanning(targetId), getMyTasks(targetId), getKpiArchive(targetId), getPlanArchive(targetId),
  ]);
  const planApproval = await db.weeklyPlanApproval.findUnique({
    where: { userId_weekStart: { userId: targetId, weekStart: plan.weekStart } },
    select: { status: true, comment: true },
  });

  // существующие задачи, которые ещё не в плане недели (для выбора «обрати наявну»)
  const planTaskIds = new Set(plan.planItems.map((i) => i.task?.id).filter(Boolean) as string[]);
  const availableTasks = myTasks
    .filter((t) => t.status !== "DONE" && !planTaskIds.has(t.id))
    .map((t) => ({ id: t.id, title: t.title, priority: t.priority }));

  const isAdmin = viewer.role === "OWNER" || viewer.role === "ADMIN";
  const canManage = isAdmin || plan.user?.managerId === viewer.id; // ставит цели/KPI
  const isSelf = targetId === viewer.id;
  const canEditPlan = isSelf || canManage;
  const canEditKpiResult = isSelf || canManage;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Планування</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthLabel(plan.month)} {plan.year} · тиждень {weekLabel(plan.weekStart)}
          </p>
        </div>
        {targets.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {targets.map((t) => (
              <Link
                key={t.id}
                href={`/planning?user=${t.id}`}
                className={cn(
                  "rounded-full px-3 py-1 text-sm transition-colors",
                  t.id === targetId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {t.id === viewer.id ? "Я" : t.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Верх доски пополам: слева KPI месяца, справа план на неделю */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <KpiBlock userId={targetId} year={plan.year} month={plan.month} kpis={plan.kpis} canManage={canManage} canEditResult={canEditKpiResult} />
        </div>
        <div className="rounded-xl border bg-card p-5">
          <WeeklyPlan
            userId={targetId}
            weekStart={plan.weekStart.toISOString()}
            items={plan.planItems.map((i) => ({
              id: i.id, title: i.title, priority: i.priority, approved: i.approved,
              projectId: i.projectId, task: i.task,
            }))}
            projects={plan.projects}
            availableTasks={availableTasks}
            canEdit={canEditPlan}
            status={planApproval?.status ?? "DRAFT"}
            comment={planApproval?.comment ?? null}
            isSelf={isSelf}
            canManage={canManage}
          />
        </div>
      </div>

      {/* Архивы внизу */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Gauge className="size-4 text-muted-foreground" /> Архів KPI
          </h3>
          {kpiArchive.length === 0 ? (
            <p className="text-sm text-muted-foreground">Архів порожній.</p>
          ) : (
            <div className="space-y-1.5">
              {kpiArchive.map((g) => (
                <details key={`${g.year}-${g.month}`} className="rounded-lg border bg-muted/20 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">{monthLabel(g.month)} {g.year} <span className="text-xs text-muted-foreground">({g.kpis.length})</span></summary>
                  <ul className="mt-2 space-y-1">
                    {g.kpis.map((k) => (
                      <li key={k.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>{k.title}</span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>ціль {k.target ?? "—"}</span>
                          {k.actualValue != null && <span>факт {k.actualValue}</span>}
                          {k.achieved === true && <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600">досягнуто</span>}
                          {k.achieved === false && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">ні</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks className="size-4 text-muted-foreground" /> Архів пріоритетів тижня
          </h3>
          {planArchive.length === 0 ? (
            <p className="text-sm text-muted-foreground">Архів порожній.</p>
          ) : (
            <div className="space-y-1.5">
              {planArchive.map((g) => (
                <details key={g.weekStart.toISOString()} className="rounded-lg border bg-muted/20 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">Тиждень №{isoWeekNumber(g.weekStart)} <span className="text-xs text-muted-foreground">· {weekLabel(g.weekStart)} ({g.items.length})</span></summary>
                  <ul className="mt-2 space-y-1">
                    {g.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 text-sm">
                        <span className={cn("flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold", priorityStyle(it.priority))}>{it.priority}</span>
                        <span className="flex-1">{it.title}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
