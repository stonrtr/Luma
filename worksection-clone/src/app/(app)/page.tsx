import Link from "next/link";
import { requireUser } from "@/server/dal";
import { getMyTasks } from "@/server/queries/tasks";
import { getMonthlyKpis } from "@/server/queries/planning";
import { getProjectsForUser } from "@/server/queries/projects";
import { getMyWeek } from "@/server/queries/calendar";
import { MyWorkspace } from "@/components/workspace/my-workspace";
import { KpiStrip } from "@/components/workspace/kpi-strip";
import type { WeekData, WeekDay } from "@/components/calendar/week-calendar";
import type { BoardTask } from "@/components/board/types";
import { mondayOf, addDays } from "@/lib/week";
import { formatMinutes } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function WorkloadBar({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const over = used > cap;
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-lg border bg-card px-3 py-1.5">
      <span className="whitespace-nowrap text-xs text-muted-foreground">{label}</span>
      <div className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", over ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("whitespace-nowrap text-xs font-semibold", over && "text-destructive")}>
        {formatMinutes(used)}<span className="font-normal text-muted-foreground"> / {formatMinutes(cap)}</span>
      </span>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; ws?: string }>;
}) {
  const user = await requireUser();
  const { view, ws } = await searchParams;
  const tasks = await getMyTasks(user.id);
  const kpis = await getMonthlyKpis(user.id);
  const myProjects = (await getProjectsForUser(user.id)).map((p) => ({ id: p.id, name: p.name, color: p.color }));

  // Данные для вида «Календар» — недельный тайм-грид
  let calendar: WeekData | undefined;
  if (view === "calendar") {
    const weekStart = mondayOf(ws ? new Date(ws) : new Date());
    const weekEnd = addDays(weekStart, 7);
    const { tasks: wkTasks, calls, logs, weeklyHours } = await getMyWeek(user.id, weekStart);
    const dailyCap = weeklyHours ? Math.round((weeklyHours / 5) * 60) : 480;
    const START_H = 8, END_H = 22;
    const dayNames = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];
    const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
    const dayIndex = (d: Date) => Math.floor((new Date(d).setHours(0, 0, 0, 0) - weekStart.getTime()) / 86400000);

    const days: WeekDay[] = Array.from({ length: 7 }, (_, di) => {
      const date = addDays(weekStart, di);
      return {
        weekdayLabel: dayNames[di],
        dateLabel: `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`,
        isToday: date.getTime() === todayD.getTime(),
        events: [], allDay: [],
        summary: { freeMin: dailyCap, tasksDone: 0, tasksPlanned: 0, actualMin: 0, plannedMin: 0 },
      };
    });

    for (const tk of wkTasks) {
      const inWeek = (d: Date | null) => d && new Date(d) >= weekStart && new Date(d) < weekEnd;
      const done = tk.status === "DONE";
      const color = tk.project?.color ?? (done ? "#10b981" : "#4f46e5");
      let di = -1;
      if (inWeek(tk.scheduledAt)) {
        di = dayIndex(tk.scheduledAt!);
        const s = new Date(tk.scheduledAt!);
        const startMin = s.getHours() * 60 + s.getMinutes();
        const dur = tk.plannedMinutes ?? 60;
        days[di].events.push({ startMin, endMin: startMin + dur, title: tk.title, color, type: "task", href: `/tasks/${tk.id}`, done });
      } else if (inWeek(tk.dueDate)) {
        di = dayIndex(tk.dueDate!);
        days[di].allDay.push({ title: tk.title, color, href: `/tasks/${tk.id}`, done });
      }
      if (di >= 0 && di < 7) {
        const sm = days[di].summary;
        sm.tasksPlanned += 1;
        if (done) sm.tasksDone += 1;
        sm.plannedMin += tk.plannedMinutes ?? 0;
      }
    }
    for (const c of calls) {
      const di = dayIndex(c.scheduledAt);
      if (di < 0 || di >= 7) continue;
      const s = new Date(c.scheduledAt);
      const startMin = s.getHours() * 60 + s.getMinutes();
      days[di].events.push({ startMin, endMin: startMin + (c.durationMin || 30), title: c.title, color: "#0ea5e9", type: "call" });
    }
    for (const l of logs) {
      const di = dayIndex(l.loggedAt);
      if (di >= 0 && di < 7) days[di].summary.actualMin += l.minutes;
    }
    for (const d of days) d.summary.freeMin = Math.max(0, dailyCap - d.summary.plannedMin);

    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    calendar = {
      days, startHour: START_H, endHour: END_H,
      title: `${fmt(weekStart)} — ${fmt(addDays(weekStart, 6))}`,
      prevHref: `/?view=calendar&ws=${iso(addDays(weekStart, -7))}`,
      nextHref: `/?view=calendar&ws=${iso(addDays(weekStart, 7))}`,
      todayHref: `/?view=calendar`,
    };
  }

  const boardTasks: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: (t.scheduledAt ?? t.dueDate)?.toISOString() ?? null,
    position: t.position,
    assignedByManager: t.assignedByManager,
    plannedMinutes: t.plannedMinutes,
    isProject: !!t.projectId,
    projectName: t.project?.name ?? null,
    projectColor: t.project?.color ?? null,
    assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name })),
    tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name, color: tt.tag.color })),
    subtaskCount: t._count.subtasks,
    commentCount: t._count.comments,
    checklistTotal: t._count.checklist,
    checklistDone: t.checklist.filter((c) => c.done).length,
  }));

  // Нагрузка на день и неделю (по плановому времени незакрытых задач)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 7);
  let todayMin = 0, weekMin = 0;
  for (const t of tasks) {
    if (t.status === "DONE") continue;
    const due = t.scheduledAt ?? t.dueDate;
    if (!due) continue;
    if (due >= today && due < tomorrow) todayMin += t.plannedMinutes ?? 0;
    if (due >= weekStart && due < weekEnd) weekMin += t.plannedMinutes ?? 0;
  }
  const dailyCap = user.weeklyHours ? Math.round((user.weeklyHours / 5) * 60) : 480;
  const weekCap = user.weeklyHours ? Math.round(user.weeklyHours * 60) : 2400;

  return (
    <div className="flex flex-col">
      <KpiStrip
        kpis={kpis.map((k) => ({ id: k.id, title: k.title, target: k.target, actualValue: k.actualValue, achieved: k.achieved }))}
      />
      <header className="border-b px-6 py-2.5">
        <div className="flex max-w-2xl flex-wrap gap-3">
          <WorkloadBar label={t(user.locale, "load.today")} used={todayMin} cap={dailyCap} />
          <WorkloadBar label={t(user.locale, "load.week")} used={weekMin} cap={weekCap} />
        </div>
      </header>
      <div>
        <MyWorkspace tasks={boardTasks} userId={user.id} view={view ?? "board"} locale={user.locale} calendar={calendar} projects={myProjects} />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
