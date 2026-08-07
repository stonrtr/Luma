import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/dal";
import { getTeamOverview } from "@/server/queries/team";
import { getMyTasks, getAllTasks, getArchivedTasks, getRecentActivity } from "@/server/queries/tasks";
import { getMyWeek } from "@/server/queries/calendar";
import { zonedDateStr, zonedMinutes } from "@/lib/tz";
import { getProjectsForUser } from "@/server/queries/projects";
import { KanbanBoard } from "@/components/board/kanban-board";
import { DayBoard } from "@/components/board/day-board";
import { WeekCalendar, type WeekData, type WeekDay } from "@/components/calendar/week-calendar";
import { ArchiveList, type ArchiveRow } from "@/components/board/archive-list";
import { HistoryFeed } from "@/components/team/history-feed";
import type { BoardTask, BoardMember } from "@/components/board/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { mondayOf, addDays } from "@/lib/week";
import { cn } from "@/lib/utils";

type AnyTask = Awaited<ReturnType<typeof getMyTasks>>[number] | Awaited<ReturnType<typeof getAllTasks>>[number];

function mapTasks(tasks: AnyTask[]): BoardTask[] {
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
    projectName: t.project?.name ?? null,
    projectColor: t.project?.color ?? null,
    assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name })),
    tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name, color: tt.tag.color })),
    subtaskCount: t._count.subtasks,
    commentCount: t._count.comments,
    checklistTotal: t._count.checklist,
    checklistDone: t.checklist.filter((c) => c.done).length,
  }));
}

function mapArchive(tasks: Awaited<ReturnType<typeof getArchivedTasks>>): ArchiveRow[] {
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    projectName: t.project?.name ?? null,
    projectColor: t.project?.color ?? null,
    completedAt: (t.completedAt ?? t.updatedAt).toISOString(),
    assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name })),
  }));
}

async function buildWeek(userId: string, ws?: string): Promise<WeekData> {
  const weekStart = mondayOf(ws ? new Date(ws) : new Date());
  const weekEnd = addDays(weekStart, 7);
  const { tasks, calls, logs, weeklyHours, timezone } = await getMyWeek(userId, weekStart);
  const dailyCap = weeklyHours ? Math.round((weeklyHours / 5) * 60) : 480;
  const dayNames = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];
  const tz = timezone || "Europe/Kyiv";
  const dayKeys = Array.from({ length: 7 }, (_, di) => { const noon = addDays(weekStart, di); noon.setHours(12, 0, 0, 0); return zonedDateStr(noon, tz); });
  const todayKey = zonedDateStr(new Date(), tz);
  const dayIndex = (d: Date | string) => dayKeys.indexOf(zonedDateStr(new Date(d), tz));
  const days: WeekDay[] = Array.from({ length: 7 }, (_, di) => {
    const date = addDays(weekStart, di);
    return {
      weekdayLabel: dayNames[di],
      dateLabel: `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`,
      isToday: dayKeys[di] === todayKey,
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
      di = dayIndex(tk.scheduledAt!);
      if (di >= 0) {
        const startMin = zonedMinutes(new Date(tk.scheduledAt!), tz);
        days[di].events.push({ startMin, endMin: startMin + (tk.plannedMinutes ?? 60), title: tk.title, color, type: "task", href: `/tasks/${tk.id}`, done });
      }
    } else if (inWeek(tk.dueDate)) {
      di = dayIndex(tk.dueDate!); if (di >= 0) days[di].allDay.push({ title: tk.title, color, href: `/tasks/${tk.id}`, done });
    }
    if (di >= 0 && di < 7) { const sm = days[di].summary; sm.tasksPlanned++; if (done) sm.tasksDone++; sm.plannedMin += tk.plannedMinutes ?? 0; }
  }
  for (const c of calls) { const di = dayIndex(c.scheduledAt); if (di < 0) continue; const startMin = zonedMinutes(new Date(c.scheduledAt), tz); days[di].events.push({ startMin, endMin: startMin + (c.durationMin || 30), title: c.title, color: "#0ea5e9", type: "call" }); }
  for (const l of logs) { const di = dayIndex(l.loggedAt); if (di >= 0) days[di].summary.actualMin += l.minutes; }
  for (const d of days) d.summary.freeMin = Math.max(0, dailyCap - d.summary.plannedMin);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  return {
    days, startHour: 8, endHour: 22,
    title: `${fmt(weekStart)} — ${fmt(addDays(weekStart, 6))}`,
    prevHref: "", nextHref: "", todayHref: "",
  };
}

// Плашка счётчиков сотрудника: «Активні N», «Завершені N» + всплывающий список задач
function MemberCounters({ m }: { m: Awaited<ReturnType<typeof getTeamOverview>>["members"][number] }) {
  return (
    <span className="ml-1 flex items-center gap-2 text-[11px]">
      <span className="group/act relative flex items-center gap-1">
        <span className="text-muted-foreground">Активні</span>
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{m.weekActive}</span>
        <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-60 -translate-x-1/2 rounded-lg border bg-popover p-2 text-left shadow-lg group-hover/act:block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Активні цього тижня</span>
          {m.weekActiveTasks.length
            ? m.weekActiveTasks.map((t) => <span key={t.id} className="block truncate text-xs">• {t.title}</span>)
            : <span className="block text-xs text-muted-foreground">Немає задач</span>}
        </span>
      </span>
      <span className="group/done relative flex items-center gap-1">
        <span className="text-muted-foreground">Завершені</span>
        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-600">{m.weekDone}</span>
        <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-60 -translate-x-1/2 rounded-lg border bg-popover p-2 text-left shadow-lg group-hover/done:block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Завершені цього тижня</span>
          {m.weekDoneTasks.length
            ? m.weekDoneTasks.map((t) => <span key={t.id} className="block truncate text-xs">• {t.title}</span>)
            : <span className="block text-xs text-muted-foreground">Немає задач</span>}
        </span>
      </span>
    </span>
  );
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

  const { members } = await getTeamOverview();

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
            href={`/team?member=${m.id}&view=${view}`}
            className={cn("flex items-center gap-2 rounded-xl border bg-card px-3 py-2 transition-colors hover:bg-muted", member === m.id && "border-primary ring-1 ring-primary")}
          >
            <Avatar className="size-8"><AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{m.name}</p>
              <p className="truncate text-xs text-muted-foreground leading-tight">{m.title ?? "—"}</p>
            </div>
            <MemberCounters m={m} />
          </Link>
        ))}
      </div>

      {member === "all" ? (
        <AllView view={view} members={members.map((m) => ({ id: m.id, name: m.name }))} viewerId={viewer.id} />
      ) : (
        <MemberView memberId={member} view={view} ws={sp.ws} />
      )}

      <HistoryFeed
        items={(await getRecentActivity(60)).map((a) => ({
          id: a.id, type: a.type, actorName: a.actor.name, taskId: a.taskId, meta: a.meta, createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

// Переключатель видов для агрегата всех сотрудников
async function AllView({ view, members, viewerId }: { view: string; members: BoardMember[]; viewerId: string }) {
  const tabs = [
    { key: "day", label: "По днях" },
    { key: "board", label: "Канбан" },
    { key: "archive", label: "Архів" },
  ];
  const active = tabs.some((t) => t.key === view) ? view : "day";

  return (
    <div>
      <div className="mb-4 flex gap-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/team?view=${t.key}`}
            className={cn("rounded-md px-3 py-1 text-sm font-medium transition-colors", active === t.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {active === "archive" ? (
        <ArchiveList rows={mapArchive(await getArchivedTasks())} />
      ) : active === "board" ? (
        <AllBoardView members={members} viewerId={viewerId} />
      ) : (
        <DayBoard initialTasks={mapTasks(await getAllTasks())} />
      )}
    </div>
  );
}

async function AllBoardView({ members, viewerId }: { members: BoardMember[]; viewerId: string }) {
  const [allTasks, projects] = await Promise.all([getAllTasks(), getProjectsForUser(viewerId)]);
  return (
    <KanbanBoard
      projectId=""
      initialTasks={mapTasks(allTasks)}
      members={members}
      projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
      collapseIdeaByDefault
    />
  );
}

// Задачи конкретного сотрудника с переключателем видов
async function MemberView({ memberId, view, ws }: { memberId: string; view: string; ws?: string }) {
  const tasks = mapTasks(await getMyTasks(memberId));
  const tabs = [
    { key: "day", label: "По днях" },
    { key: "board", label: "Канбан" },
    { key: "calendar", label: "Календар" },
    { key: "archive", label: "Архів" },
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
      {view === "archive" ? (
        <ArchiveList rows={mapArchive(await getArchivedTasks(memberId))} />
      ) : view === "calendar" && calendar ? (
        <WeekCalendar data={calendar} />
      ) : view === "board" ? (
        <KanbanBoard projectId="" initialTasks={tasks} members={[]} lockedAssigneeId={memberId} />
      ) : (
        <DayBoard initialTasks={tasks} />
      )}
    </div>
  );
}
