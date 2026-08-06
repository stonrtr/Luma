import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/dal";
import { getTeamOverview } from "@/server/queries/team";
import { getMyTasks } from "@/server/queries/tasks";
import { getMyWeek } from "@/server/queries/calendar";
import { KanbanBoard } from "@/components/board/kanban-board";
import { DayBoard } from "@/components/board/day-board";
import { WeekCalendar, type WeekData, type WeekDay } from "@/components/calendar/week-calendar";
import type { BoardTask } from "@/components/board/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_DOT, priorityStyle } from "@/lib/domain";
import { initials, formatShortDate, isOverdue } from "@/lib/format";
import { mondayOf, addDays } from "@/lib/week";
import { cn } from "@/lib/utils";

function mapTasks(tasks: Awaited<ReturnType<typeof getMyTasks>>): BoardTask[] {
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: (t.scheduledAt ?? t.dueDate)?.toISOString() ?? null,
    position: t.position,
    assignedByManager: t.assignedByManager,
    plannedMinutes: t.plannedMinutes,
    isProject: !!t.projectId,
    assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name })),
    tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name, color: tt.tag.color })),
    subtaskCount: t._count.subtasks,
    commentCount: t._count.comments,
    checklistTotal: t._count.checklist,
    checklistDone: t.checklist.filter((c) => c.done).length,
  }));
}

async function buildWeek(userId: string, ws?: string): Promise<WeekData> {
  const weekStart = mondayOf(ws ? new Date(ws) : new Date());
  const weekEnd = addDays(weekStart, 7);
  const { tasks, calls, logs, weeklyHours } = await getMyWeek(userId, weekStart);
  const dailyCap = weeklyHours ? Math.round((weeklyHours / 5) * 60) : 480;
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
  const inWeek = (d: Date | null) => !!d && new Date(d) >= weekStart && new Date(d) < weekEnd;
  for (const tk of tasks) {
    const done = tk.status === "DONE";
    const color = tk.project?.color ?? (done ? "#10b981" : "#4f46e5");
    let di = -1;
    if (inWeek(tk.scheduledAt)) {
      di = dayIndex(tk.scheduledAt!); const s = new Date(tk.scheduledAt!);
      const startMin = s.getHours() * 60 + s.getMinutes();
      days[di].events.push({ startMin, endMin: startMin + (tk.plannedMinutes ?? 60), title: tk.title, color, type: "task", href: `/tasks/${tk.id}`, done });
    } else if (inWeek(tk.dueDate)) {
      di = dayIndex(tk.dueDate!); days[di].allDay.push({ title: tk.title, color, href: `/tasks/${tk.id}`, done });
    }
    if (di >= 0 && di < 7) { const sm = days[di].summary; sm.tasksPlanned++; if (done) sm.tasksDone++; sm.plannedMin += tk.plannedMinutes ?? 0; }
  }
  for (const c of calls) { const di = dayIndex(c.scheduledAt); if (di < 0 || di >= 7) continue; const s = new Date(c.scheduledAt); const startMin = s.getHours() * 60 + s.getMinutes(); days[di].events.push({ startMin, endMin: startMin + (c.durationMin || 30), title: c.title, color: "#0ea5e9", type: "call" }); }
  for (const l of logs) { const di = dayIndex(l.loggedAt); if (di >= 0 && di < 7) days[di].summary.actualMin += l.minutes; }
  for (const d of days) d.summary.freeMin = Math.max(0, dailyCap - d.summary.plannedMin);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    days, startHour: 8, endHour: 22,
    title: `${fmt(weekStart)} — ${fmt(addDays(weekStart, 6))}`,
    prevHref: "", nextHref: "", todayHref: "", // подставим в вызывающем коде
  };
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; view?: string; ws?: string }>;
}) {
  const viewer = await requireUser();
  if (viewer.role !== "OWNER" && viewer.role !== "ADMIN") redirect("/");
  const sp = await searchParams;
  const member = sp.member ?? "all";
  const view = sp.view ?? "day";

  const { members, tasks } = await getTeamOverview();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Компактный выбор сотрудника */}
      <div className="mb-6 flex flex-wrap items-stretch gap-2">
        <Link href="/team" className={cn("flex items-center rounded-xl border px-4 text-sm font-medium transition-colors", member === "all" ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted")}>
          Всі
        </Link>
        {members.map((m) => (
          <Link
            key={m.id}
            href={`/team?member=${m.id}`}
            className={cn("flex items-center gap-2 rounded-xl border bg-card px-3 py-2 transition-colors hover:bg-muted", member === m.id && "border-primary ring-1 ring-primary")}
          >
            <Avatar className="size-8"><AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{m.name}</p>
              <p className="truncate text-xs text-muted-foreground leading-tight">{m.title ?? "—"}</p>
            </div>
            <span className="ml-1 flex items-center gap-1">
              <span className="group/act relative">
                <span className="block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{m.weekActive}</span>
                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 translate-y-1 scale-90 rounded-md bg-primary px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-primary-foreground opacity-0 shadow-md transition-all duration-150 group-hover/act:translate-y-0 group-hover/act:scale-100 group-hover/act:opacity-100">
                  Активні
                </span>
              </span>
              <span className="group/done relative">
                <span className="block rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">{m.weekDone}</span>
                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 translate-y-1 scale-90 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-white opacity-0 shadow-md transition-all duration-150 group-hover/done:translate-y-0 group-hover/done:scale-100 group-hover/done:opacity-100">
                  Завершені
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>

      {member === "all" ? (
        <AllBoard tasks={tasks} />
      ) : (
        <MemberView memberId={member} view={view} ws={sp.ws} />
      )}
    </div>
  );
}

// Агрегатная доска всех задач по статусам
function AllBoard({ tasks }: { tasks: Awaited<ReturnType<typeof getTeamOverview>>["tasks"] }) {
  return (
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
                        <Avatar key={a.user.id} className="size-6 border-2 border-card" title={a.user.name}><AvatarFallback className="text-[9px]">{initials(a.user.name)}</AvatarFallback></Avatar>
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
  );
}

// Задачи конкретного сотрудника с переключателем видов
async function MemberView({ memberId, view, ws }: { memberId: string; view: string; ws?: string }) {
  const tasks = mapTasks(await getMyTasks(memberId));
  const tabs = [
    { key: "day", label: "По днях" },
    { key: "board", label: "Канбан" },
    { key: "calendar", label: "Календар" },
  ];

  let calendar: WeekData | undefined;
  if (view === "calendar") {
    calendar = await buildWeek(memberId, ws);
    const weekStart = mondayOf(ws ? new Date(ws) : new Date());
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    calendar.prevHref = `/team?member=${memberId}&view=calendar&ws=${iso(addDays(weekStart, -7))}`;
    calendar.nextHref = `/team?member=${memberId}&view=calendar&ws=${iso(addDays(weekStart, 7))}`;
    calendar.todayHref = `/team?member=${memberId}&view=calendar`;
  }

  return (
    <div>
      <div className="mb-4 flex gap-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/team?member=${memberId}&view=${t.key}`}
            className={cn("rounded-md px-3 py-1 text-sm font-medium transition-colors", view === t.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {view === "calendar" && calendar ? (
        <WeekCalendar data={calendar} />
      ) : view === "board" ? (
        <KanbanBoard projectId="" initialTasks={tasks} members={[]} lockedAssigneeId={memberId} />
      ) : (
        <DayBoard initialTasks={tasks} />
      )}
    </div>
  );
}
