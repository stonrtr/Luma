import Link from "next/link";
import { KanbanBoard } from "@/components/board/kanban-board";
import { WeekCalendar, type WeekData } from "@/components/calendar/week-calendar";
import type { BoardTask } from "@/components/board/types";
import { priorityStyle, plannedLabel, TASK_STATUS_LABEL, TASK_STATUS_STYLE } from "@/lib/domain";
import { formatShortDate, isOverdue } from "@/lib/format";
import { mondayOf, addDays } from "@/lib/week";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "board", i18n: "view.board" },
  { key: "day", i18n: "view.day" },
  { key: "calendar", i18n: "nav.calendar" },
];

export function MyWorkspace({
  tasks, userId, view, locale, calendar,
}: {
  tasks: BoardTask[]; userId: string; view: string; locale: string; calendar?: WeekData;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex gap-1 px-6 pt-4">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "board" ? "/" : `/?view=${v.key}`}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              view === v.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(locale, v.i18n)}
          </Link>
        ))}
      </div>
      <div className="px-6 py-4">
        {view === "calendar" && calendar ? (
          <WeekCalendar data={calendar} />
        ) : view === "day" ? (
          <DayView tasks={tasks} />
        ) : (
          <KanbanBoard projectId="" initialTasks={tasks} members={[]} lockedAssigneeId={userId} />
        )}
      </div>
    </div>
  );
}

function DayView({ tasks }: { tasks: BoardTask[] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(mondayOf(today), 7);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const buckets: { key: string; label: string; items: BoardTask[] }[] = [
    { key: "idea", label: "Ідеї", items: [] },
    { key: "overdue", label: "Прострочені", items: [] },
    { key: "today", label: "Сьогодні", items: [] },
    { key: "week", label: "Цього тижня", items: [] },
    { key: "month", label: "Цього місяця", items: [] },
    { key: "later", label: "Пізніше", items: [] },
  ];
  const by = Object.fromEntries(buckets.map((b) => [b.key, b])) as Record<string, (typeof buckets)[0]>;

  for (const t of tasks) {
    if (t.status === "IDEA") { by.idea.items.push(t); continue; }
    if (!t.dueDate) { by.later.items.push(t); continue; }
    const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
    if (t.status !== "DONE" && d < today) by.overdue.items.push(t);
    else if (d >= today && d < tomorrow) by.today.items.push(t);
    else if (d >= tomorrow && d < weekEnd) by.week.items.push(t);
    else if (d >= weekEnd && d < monthEnd) by.month.items.push(t);
    else by.later.items.push(t);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {buckets.filter((b) => b.items.length > 0).map((b) => (
        <div key={b.key} className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <h3 className={cn("text-sm font-semibold", b.key === "overdue" && "text-destructive")}>{b.label}</h3>
            <span className="text-xs text-muted-foreground">{b.items.length}</span>
          </div>
          <ul className="space-y-1.5">
            {b.items.map((t) => (
              <li key={t.id}>
                <Link href={`/tasks/${t.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold", priorityStyle(t.priority))}>{t.priority}</span>
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.plannedMinutes != null && <span className="shrink-0 text-xs text-muted-foreground">{plannedLabel(t.plannedMinutes)}</span>}
                  <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", TASK_STATUS_STYLE[t.status])}>{TASK_STATUS_LABEL[t.status]}</span>
                  {t.dueDate && b.key !== "today" && b.key !== "idea" && (
                    <span className={cn("shrink-0 text-xs", isOverdue(t.dueDate) && t.status !== "DONE" ? "text-destructive" : "text-muted-foreground")}>
                      {formatShortDate(t.dueDate)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {tasks.length === 0 && <p className="text-sm text-muted-foreground">Задач поки немає.</p>}
    </div>
  );
}
