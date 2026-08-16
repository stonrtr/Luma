import Link from "next/link";
import { ExportTasksButton } from "@/components/workspace/export-tasks-button";
import { KanbanBoard } from "@/components/board/kanban-board";
import { DayBoard } from "@/components/board/day-board";
import { WeekCalendar, type WeekData } from "@/components/calendar/week-calendar";
import { ArchiveList, type ArchiveRow } from "@/components/board/archive-list";
import { RecurringBlock, type Recurring } from "@/components/planning/recurring-block";
import type { BoardTask } from "@/components/board/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "board", i18n: "view.board" },
  { key: "day", i18n: "view.day" },
  { key: "calendar", i18n: "nav.calendar" },
  { key: "recurring", i18n: "view.recurring" },
  { key: "archive", i18n: "view.archive" },
];

export function MyWorkspace({
  tasks, userId, view, locale, calendar, projects, archive, recurring, teamRecurring,
}: {
  tasks: BoardTask[]; userId: string; view: string; locale: string; calendar?: WeekData; projects?: { id: string; name: string; color: string }[]; archive?: ArchiveRow[]; recurring?: Recurring[]; teamRecurring?: (Recurring & { assigneeName: string })[];
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap gap-1">
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
        <ExportTasksButton userId={userId} locale={locale} />
      </div>
      <div className="px-4 py-4 sm:px-6">
        {view === "recurring" ? (
          <div className="max-w-2xl"><RecurringBlock userId={userId} items={recurring ?? []} canEdit teamItems={teamRecurring} /></div>
        ) : view === "archive" ? (
          <ArchiveList rows={archive ?? []} />
        ) : view === "calendar" && calendar ? (
          <WeekCalendar data={calendar} locale={locale} ownerId={userId} />
        ) : view === "day" ? (
          <DayBoard initialTasks={tasks} locale={locale} />
        ) : (
          <KanbanBoard projectId="" initialTasks={tasks} members={[]} lockedAssigneeId={userId} projects={projects} locale={locale} />
        )}
      </div>
    </div>
  );
}
