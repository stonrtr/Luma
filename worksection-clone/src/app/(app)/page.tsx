import Link from "next/link";
import { requireUser } from "@/server/dal";
import { getMyTasks } from "@/server/queries/tasks";
import { MyWorkspace } from "@/components/workspace/my-workspace";
import type { BoardTask } from "@/components/board/types";
import { mondayOf, addDays } from "@/lib/week";
import { formatMinutes } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function WorkloadBar({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const over = used > cap;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-sm font-semibold", over && "text-destructive")}>
          {formatMinutes(used)} <span className="font-normal text-muted-foreground">/ {formatMinutes(cap)}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", over ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const { view } = await searchParams;
  const tasks = await getMyTasks(user.id);

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
    <div className="flex h-full flex-col">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t(user.locale, "home.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(user.locale, "home.greeting")}, {(user.firstName || user.name).split(" ")[0]} 👋 — {t(user.locale, "home.subtitle")}
        </p>
        <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
          <WorkloadBar label={t(user.locale, "load.today")} used={todayMin} cap={dailyCap} />
          <WorkloadBar label={t(user.locale, "load.week")} used={weekMin} cap={weekCap} />
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <MyWorkspace tasks={boardTasks} userId={user.id} view={view ?? "board"} locale={user.locale} />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
