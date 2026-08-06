import Link from "next/link";
import { requireUser } from "@/server/dal";
import { getPlanning, getPlanningTargets } from "@/server/queries/planning";
import { GoalsBlock } from "@/components/planning/goals-block";
import { KpiBlock } from "@/components/planning/kpi-block";
import { WeeklyPlan } from "@/components/planning/weekly-plan";
import { RecurringBlock } from "@/components/planning/recurring-block";
import { monthLabel, weekLabel } from "@/lib/week";
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
  const plan = await getPlanning(targetId);

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

      {/* Цели месяца — всегда перед глазами (на всю ширину) */}
      <div className="mb-4 rounded-xl border bg-card p-5">
        <GoalsBlock userId={targetId} year={plan.year} month={plan.month} goals={plan.goals} canManage={canManage} />
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
            canEdit={canEditPlan}
          />
        </div>
      </div>

      {/* Проекты в работе */}
      {plan.projects.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">Проєкти в роботі</h3>
          <div className="flex flex-wrap gap-2">
            {plan.projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm hover:bg-muted">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Регулярные задачи */}
      <div className="mt-6 rounded-xl border bg-card p-5">
        <RecurringBlock
          userId={targetId}
          items={plan.recurring.map((r) => ({ id: r.id, title: r.title, priority: r.priority, frequency: r.frequency, weekdays: r.weekdays, dayOfMonth: r.dayOfMonth }))}
          canEdit={canEditPlan}
        />
      </div>
    </div>
  );
}
