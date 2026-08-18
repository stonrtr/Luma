"use client";

import { useState } from "react";
import { differenceInCalendarDays, isPast, isToday } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/board/task-card";
import { cn } from "@/lib/utils";
import type { BoardTask } from "@/components/board/types";

type Bucket =
  | "IDEAS"
  | "OVERDUE"
  | "TODAY"
  | "TOMORROW"
  | "THIS_WEEK"
  | "THIS_MONTH";

const bucketConfig: Record<Bucket, { title: string; swatch: string; tint: string }> = {
  IDEAS: { title: "Ідеї", swatch: "bg-indigo-300", tint: "bg-indigo-50" },
  OVERDUE: { title: "Прострочені", swatch: "bg-red-500", tint: "bg-red-50" },
  TODAY: { title: "На сьогодні", swatch: "bg-orange-400", tint: "bg-orange-50" },
  TOMORROW: { title: "На завтра", swatch: "bg-emerald-400", tint: "bg-emerald-50" },
  THIS_WEEK: { title: "На тиждень", swatch: "bg-teal-400", tint: "bg-teal-50" },
  THIS_MONTH: { title: "На місяць", swatch: "bg-sky-400", tint: "bg-sky-50" },
};

const bucketOrder: Bucket[] = [
  "IDEAS",
  "OVERDUE",
  "TODAY",
  "TOMORROW",
  "THIS_WEEK",
  "THIS_MONTH",
];

function bucketOf(task: BoardTask): Bucket | null {
  if (task.status === "IDEA") return "IDEAS";
  if (!task.dueDate) return null;

  const days = differenceInCalendarDays(task.dueDate, new Date());

  if (task.status !== "DONE" && (days < 0 || (days === 0 && isPast(task.dueDate) && !isToday(task.dueDate)))) {
    return "OVERDUE";
  }
  if (days === 0) return "TODAY";
  if (days === 1) return "TOMORROW";
  if (days >= 2 && days <= 7) return "THIS_WEEK";
  if (days > 7 && days <= 30) return "THIS_MONTH";
  return null;
}

export function DayBoard({
  tasks,
  selectedIds,
  onToggleSelected,
}: {
  tasks: BoardTask[];
  selectedIds: Set<string>;
  onToggleSelected: (taskId: string, checked: boolean) => void;
}) {
  const [collapsedOverrides, setCollapsedOverrides] = useState<
    Map<Bucket, boolean>
  >(new Map());

  function toggleCollapsed(bucket: Bucket, currentlyCollapsed: boolean) {
    setCollapsedOverrides((prev) => {
      const next = new Map(prev);
      next.set(bucket, !currentlyCollapsed);
      return next;
    });
  }

  const buckets: Record<Bucket, BoardTask[]> = {
    IDEAS: [],
    OVERDUE: [],
    TODAY: [],
    TOMORROW: [],
    THIS_WEEK: [],
    THIS_MONTH: [],
  };

  for (const task of tasks) {
    const bucket = bucketOf(task);
    if (bucket) buckets[bucket].push(task);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {bucketOrder.map((bucket) => {
        const config = bucketConfig[bucket];
        const items = buckets[bucket];
        const defaultCollapsed = items.length === 0;
        const collapsed = collapsedOverrides.get(bucket) ?? defaultCollapsed;

        if (collapsed) {
          return (
            <div
              key={bucket}
              className={cn(
                "flex w-10 shrink-0 flex-col items-center gap-2 rounded-lg py-3",
                config.tint,
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => toggleCollapsed(bucket, collapsed)}
                aria-label={`Развернуть «${config.title}»`}
              >
                <ChevronRight className="size-4" />
              </Button>
              <span className={cn("size-2.5 shrink-0 rounded-sm", config.swatch)} />
              <span className="flex-1 text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]">
                {config.title}
              </span>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
          );
        }

        return (
          <div
            key={bucket}
            className={cn(
              "flex w-64 shrink-0 flex-col gap-2 rounded-lg p-2",
              config.tint,
            )}
          >
            <div className="flex items-center gap-1 px-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => toggleCollapsed(bucket, collapsed)}
                aria-label={`Свернуть «${config.title}»`}
              >
                <ChevronDown className="size-4" />
              </Button>
              <span className={cn("size-2.5 shrink-0 rounded-sm", config.swatch)} />
              <h2 className="text-sm font-semibold">{config.title}</h2>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  draggable={false}
                  selected={selectedIds.has(task.id)}
                  onToggleSelected={onToggleSelected}
                  hasSelection={selectedIds.size > 0}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
