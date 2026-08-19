import Link from "next/link";
import { requireUser } from "@/server/dal";
import { t } from "@/lib/i18n";
import { getPlanning, getPlanningTargets, ensureMonthlyKpis, getKpiArchive, getPlanArchive } from "@/server/queries/planning";
import { getWeeklyWins } from "@/server/queries/wins";
import { getMyTasks } from "@/server/queries/tasks";
import { KpiBlock, KpiAchievedToggle } from "@/components/planning/kpi-block";
import { WeeklyPlan } from "@/components/planning/weekly-plan";
import { WeeklyWins, WeeklyWinsArchive } from "@/components/planning/weekly-wins";
import { db } from "@/server/db";
import { Gauge, ListChecks, ChevronDown, Trophy, CircleCheck, Circle, Undo2 } from "lucide-react";
import { monthLabel, weekLabel, isoWeekNumber, weekStartInTz } from "@/lib/week";
import { priorityTone } from "@/lib/domain";
import { cn } from "@/lib/utils";

type KpiMonthGroup = Awaited<ReturnType<typeof getKpiArchive>>[number];
type PlanWeekGroup = Awaited<ReturnType<typeof getPlanArchive>>[number];

// Один месяц KPI (сворачиваемый). Внутри года год не дублируем.
function KpiMonthDetails({ g, showYear = true, locale, canEdit = false }: { g: KpiMonthGroup; showYear?: boolean; locale: string; canEdit?: boolean }) {
  return (
    <details className="group rounded-lg border bg-muted/20 px-3 py-2">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">{monthLabel(g.month, locale)}{showYear ? ` ${g.year}` : ""} <span className="text-xs text-muted-foreground">({g.kpis.length})</span></span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2 space-y-1">
        {g.kpis.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-2 text-sm">
            <span>{k.title}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t(locale, "kpi.target")} {k.target ?? "—"}</span>
              {k.actualValue != null && <span>{t(locale, "kpi.fact")} {k.actualValue}</span>}
              {canEdit ? (
                <KpiAchievedToggle id={k.id} actualValue={k.actualValue} achieved={k.achieved} locale={locale} />
              ) : (
                <>
                  {k.achieved === true && <span className="rounded-full bg-accent text-accent-foreground px-1.5 py-0.5 text-[10px]">{t(locale, "kpi.achievedShort")}</span>}
                  {k.achieved === false && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">{t(locale, "kpi.notAchievedShort")}</span>}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Один тиждень пріоритетів (сворачиваемый) с отметкой виконано/не виконано.
function WeekDetails({ g, locale }: { g: PlanWeekGroup; locale: string }) {
  return (
    <details className="group rounded-lg border bg-muted/20 px-3 py-2">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">{t(locale, "plan.week")} №{isoWeekNumber(g.weekStart)} <span className="text-xs text-muted-foreground">· {weekLabel(g.weekStart, locale)} ({g.items.length})</span></span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2 space-y-1">
        {g.items.map((it) => {
          const done = it.task?.status === "DONE";
          return (
            <li key={it.id} className="flex items-center gap-2 text-sm">
              <span className="flex size-[19px] shrink-0 items-center justify-center rounded-full border-[1.25px] bg-transparent text-[10px] font-semibold" style={{ color: priorityTone(it.priority), borderColor: priorityTone(it.priority) }}>{it.priority}</span>
              <span className={cn("flex-1", done && "text-muted-foreground line-through")}>{it.title}</span>
              {done ? (
                <span className="shrink-0 rounded-full bg-accent text-accent-foreground px-1.5 py-0.5 text-[10px]">{t(locale, "plan.doneMark")}</span>
              ) : (
                <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">{t(locale, "plan.notDoneMark")}</span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const targetsRaw = await getPlanningTargets(viewer.id, viewer.role);
  // «Я» (сам пользователь) — всегда первым в переключателе, остальные по имени
  const targets = [...targetsRaw].sort((a, b) => (a.id === viewer.id ? -1 : b.id === viewer.id ? 1 : 0));
  // Статус плана на ТЕКУЩУЮ неделю для галочек на плашках (сбрасывается с новой неделей)
  const weekMarker = weekStartInTz(viewer.timezone || "Europe/Kyiv");
  const targetApprovals = await db.weeklyPlanApproval.findMany({
    where: { userId: { in: targets.map((x) => x.id) }, weekStart: weekMarker },
    select: { userId: true, status: true },
  });
  const planStatusByUser = new Map(targetApprovals.map((a) => [a.userId, a.status]));
  // Прямые подчинённые (managerId = я) — зелёный значок; кто ниже по иерархии — жёлтый
  const targetManagers = await db.user.findMany({ where: { id: { in: targets.map((x) => x.id) } }, select: { id: true, managerId: true } });
  const managerOf = new Map(targetManagers.map((u) => [u.id, u.managerId]));

  const targetId = sp.user && targets.some((t) => t.id === sp.user) ? sp.user : viewer.id;
  // авто-KPI: если на этот месяц целей нет — переносим из прошлого
  await ensureMonthlyKpis(targetId);
  const [plan, myTasks, kpiArchive, planArchive, wins] = await Promise.all([
    getPlanning(targetId), getMyTasks(targetId), getKpiArchive(targetId), getPlanArchive(targetId), getWeeklyWins(targetId),
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

  const nowYear = new Date().getFullYear();
  // KPI: месяцы текущего года — по отдельности; завершённые года — свёрнуты в группу «рік».
  const kpiCurrentMonths = kpiArchive.filter((g) => g.year === nowYear);
  const kpiPastByYear = (() => {
    const m = new Map<number, typeof kpiArchive>();
    for (const g of kpiArchive.filter((x) => x.year < nowYear)) { if (!m.has(g.year)) m.set(g.year, []); m.get(g.year)!.push(g); }
    return [...m.entries()].map(([year, months]) => ({ year, months, count: months.reduce((n, x) => n + x.kpis.length, 0) })).sort((a, b) => b.year - a.year);
  })();

  const nowMonth = new Date().getMonth();
  // Приоритети: тижні поточного місяця — окремо; завершені місяці — свёрнуты по місяцю (усі тижні місяця).
  const planCurrentWeeks = planArchive.filter((g) => g.weekStart.getFullYear() === nowYear && g.weekStart.getMonth() === nowMonth);
  const planPastByMonth = (() => {
    const m = new Map<string, { year: number; month: number; weeks: typeof planArchive; count: number }>();
    for (const g of planArchive) {
      const y = g.weekStart.getFullYear(), mo = g.weekStart.getMonth();
      if (y === nowYear && mo === nowMonth) continue; // текущий месяц — не группируем
      const key = `${y}-${mo}`;
      if (!m.has(key)) m.set(key, { year: y, month: mo, weeks: [], count: 0 });
      const e = m.get(key)!; e.weeks.push(g); e.count += g.items.length;
    }
    return [...m.values()].sort((a, b) => b.year - a.year || b.month - a.month);
  })();

  const isAdmin = viewer.role === "OWNER" || viewer.role === "ADMIN";
  const canManage = isAdmin || plan.user?.managerId === viewer.id; // ставит цели/KPI
  const isSelf = targetId === viewer.id;
  const canEditPlan = isSelf || canManage;
  const canEditKpiResult = isSelf; // факт + «досягнуто» вносить лише сам співробітник

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(viewer.locale, "page.planning")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthLabel(plan.month, viewer.locale)} {plan.year} · {t(viewer.locale, "plan.week")} {weekLabel(plan.weekStart, viewer.locale)}
          </p>
        </div>
        {targets.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {targets.map((tg) => {
              const st = planStatusByUser.get(tg.id); // PENDING=подан, APPROVED=утверждён
              // Прямой подчинённый (или сам) — зелёный; кто ниже по иерархии — жёлтый
              const direct = tg.id === viewer.id || managerOf.get(tg.id) === viewer.id;
              const okColor = direct ? "text-[#3D6B26] dark:text-[#A9D97F]" : "text-[#B8860B] dark:text-[#E0B84A]";
              return (
                <Link
                  key={tg.id}
                  href={`/planning?user=${tg.id}`}
                  className={cn(
                    "relative rounded-full px-3 py-1 text-sm transition-colors",
                    tg.id === targetId ? "border border-[#B7EE7A] bg-accent text-accent-foreground dark:border-[#3f5a2e]" : "bg-muted text-muted-foreground hover:bg-accent",
                  )}
                >
                  {/* Значок в правом верхнем углу, выступает за плашку:
                      подан — зелёный кружок; утверждён — зелёный кружок с галочкой;
                      возвращён на доработку — красная стрелка разворота */}
                  {st === "PENDING" && (
                    <Circle className={cn("absolute -right-1.5 -top-1.5 size-4 rounded-full bg-background", okColor)} />
                  )}
                  {st === "APPROVED" && (
                    <CircleCheck className={cn("absolute -right-1.5 -top-1.5 size-4 rounded-full bg-background", okColor)} />
                  )}
                  {st === "RETURNED" && (
                    <Undo2 className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-background text-destructive" />
                  )}
                  {tg.id === viewer.id ? "Я" : tg.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Верх: KPI месяца · приоритеты недели · победы недели */}
      <div className="grid items-start gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <KpiBlock userId={targetId} year={plan.year} month={plan.month} kpis={plan.kpis} canManage={canManage} canEditResult={canEditKpiResult} locale={viewer.locale} />
        </div>
        <div className="rounded-xl border bg-card p-5">
          <WeeklyPlan
            userId={targetId}
            locale={viewer.locale}
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
            ownerIsTopAdmin={plan.user?.role === "OWNER"}
          />
        </div>
        <div className="rounded-xl border bg-card p-5">
          <WeeklyWins weekStart={wins.weekStart} current={wins.current} filled={wins.filled} canRecord={wins.canRecord} canEdit={isSelf} />
        </div>
      </div>

      {/* Архивы внизу */}
      <div className="mt-8 grid items-start gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Gauge className="size-4 text-muted-foreground" /> {t(viewer.locale, "plan.kpiArchive")}
          </h3>
          {kpiArchive.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(viewer.locale, "plan.archiveEmpty")}</p>
          ) : (
            <div className="space-y-1.5">
              {/* поточний рік — місяці окремо */}
              {kpiCurrentMonths.map((g) => <KpiMonthDetails key={`${g.year}-${g.month}`} g={g} showYear={false} locale={viewer.locale} canEdit={canEditKpiResult} />)}
              {/* завершені роки — згорнуто */}
              {kpiPastByYear.map((y) => (
                <details key={y.year} className="group rounded-lg border bg-muted/20 px-3 py-2">
                  <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2">{y.year} <span className="text-xs text-muted-foreground">({y.count})</span></span><ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
                  <div className="mt-2 space-y-1.5">
                    {y.months.map((g) => <KpiMonthDetails key={`${g.year}-${g.month}`} g={g} showYear={false} locale={viewer.locale} canEdit={canEditKpiResult} />)}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks className="size-4 text-muted-foreground" /> {t(viewer.locale, "plan.weekArchive")}
          </h3>
          {planArchive.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(viewer.locale, "plan.archiveEmpty")}</p>
          ) : (
            <div className="space-y-1.5">
              {/* поточний місяць — тижні окремо */}
              {planCurrentWeeks.map((g) => <WeekDetails key={g.weekStart.toISOString()} g={g} locale={viewer.locale} />)}
              {/* завершені місяці — згорнуто (усі тижні місяця) */}
              {planPastByMonth.map((mo) => (
                <details key={`${mo.year}-${mo.month}`} className="group rounded-lg border bg-muted/20 px-3 py-2">
                  <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2">{monthLabel(mo.month, viewer.locale)} {mo.year} <span className="text-xs text-muted-foreground">· {mo.weeks.length} {t(viewer.locale, "plan.weeksShort")} ({mo.count})</span></span><ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
                  <div className="mt-2 space-y-1.5">
                    {mo.weeks.map((g) => <WeekDetails key={g.weekStart.toISOString()} g={g} locale={viewer.locale} />)}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Trophy className="size-4 text-muted-foreground" /> {t(viewer.locale, "wins.archiveH")}
          </h3>
          <WeeklyWinsArchive archive={wins.archive} canEdit={isSelf} locale={viewer.locale} />
        </div>
      </div>
    </div>
  );
}
