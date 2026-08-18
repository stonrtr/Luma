"use client";

import { useMemo, useState } from "react";
import {
  addWeeks,
  format,
  isSameDay,
  isToday,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/board/task-card";
import { cn } from "@/lib/utils";
import type { BoardTask } from "@/components/board/types";

export function CalendarBoard({
  tasks,
  selectedIds,
  onToggleSelected,
}: {
  tasks: BoardTask[];
  selectedIds: Set<string>;
  onToggleSelected: (taskId: string, checked: boolean) => void;
}) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );

  const days = useMemo(
    () =>
      Array.from(
        { length: 5 },
        (_, i) =>
          new Date(
            weekStart.getFullYear(),
            weekStart.getMonth(),
            weekStart.getDate() + i,
          ),
      ),
    [weekStart],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setWeekStart((d) => addWeeks(d, -1))}
          aria-label="Предыдущая неделя"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
          Сегодня
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setWeekStart((d) => addWeeks(d, 1))}
          aria-label="Следующая неделя"
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-2 text-sm text-muted-foreground">
          {format(days[0], "d MMM", { locale: ru })} –{" "}
          {format(days[4], "d MMM yyyy", { locale: ru })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {days.map((day) => {
          const dayTasks = tasks.filter(
            (task) => task.dueDate && isSameDay(task.dueDate, day),
          );
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex min-h-40 flex-col gap-2 rounded-lg border p-2",
                isToday(day) && "border-primary bg-primary/5",
              )}
            >
              <div className="px-1 text-sm font-semibold capitalize">
                {format(day, "EEEEEE, d MMM", { locale: ru })}
              </div>
              <div className="flex flex-col gap-2">
                {dayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    draggable={false}
                    showAssignee={false}
                    selected={selectedIds.has(task.id)}
                    onToggleSelected={onToggleSelected}
                    hasSelection={selectedIds.size > 0}
                  />
                ))}
                {dayTasks.length === 0 && (
                  <p className="px-1 text-xs text-muted-foreground">Пусто</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
