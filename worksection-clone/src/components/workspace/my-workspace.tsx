import Link from "next/link";
import { KanbanBoard } from "@/components/board/kanban-board";
import { DayBoard } from "@/components/board/day-board";
import { WeekCalendar, type WeekData } from "@/components/calendar/week-calendar";
import type { BoardTask } from "@/components/board/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "board", i18n: "view.board" },
  { key: "day", i18n: "view.day" },
  { key: "calendar", i18n: "nav.calendar" },
];

export function MyWorkspace({
  tasks, userId, view, locale, calendar, projects,
}: {
  tasks: BoardTask[]; userId: string; view: string; locale: string; calendar?: WeekData; projects?: { id: string; name: string; color: string }[];
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
          <DayBoard initialTasks={tasks} />
        ) : (
          <KanbanBoard projectId="" initialTasks={tasks} members={[]} lockedAssigneeId={userId} projects={projects} />
        )}
      </div>
    </div>
  );
}
