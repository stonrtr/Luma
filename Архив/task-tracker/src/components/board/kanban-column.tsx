"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TaskCard } from "@/components/board/task-card";
import { NewTaskDialog } from "@/components/board/new-task-dialog";
import { Button } from "@/components/ui/button";
import { statusColors } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import type { BoardTask } from "@/components/board/types";
import type { TaskStatus } from "@/generated/prisma/client";

export function KanbanColumn({
  status,
  title,
  tasks,
  boardUserId,
  users,
  selectedIds,
  onToggleSelected,
  collapsed,
  onToggleCollapsed,
}: {
  status: TaskStatus;
  title: string;
  tasks: BoardTask[];
  boardUserId: string;
  users: { id: string; name: string }[];
  selectedIds: Set<string>;
  onToggleSelected: (taskId: string, checked: boolean) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const colors = statusColors[status];

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex w-10 shrink-0 flex-col items-center gap-2 rounded-lg py-3",
          colors.tint,
          isOver && "ring-2 ring-primary",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onToggleCollapsed}
          aria-label={`Развернуть колонку «${title}»`}
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className={cn("size-2.5 shrink-0 rounded-sm", colors.swatch)} />
        <span className="flex-1 text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]">
          {title}
        </span>
        <NewTaskDialog
          boardUserId={boardUserId}
          initialStatus={status}
          users={users}
        />
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-lg p-2",
        colors.tint,
        isOver && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onToggleCollapsed}
            aria-label={`Свернуть колонку «${title}»`}
          >
            <ChevronDown className="size-4" />
          </Button>
          <span className={cn("size-2.5 shrink-0 rounded-sm", colors.swatch)} />
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>
        <NewTaskDialog
          boardUserId={boardUserId}
          initialStatus={status}
          users={users}
        />
      </div>
      <div ref={setNodeRef} className="flex min-h-12 flex-col gap-2">
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              selected={selectedIds.has(task.id)}
              onToggleSelected={onToggleSelected}
              hasSelection={selectedIds.size > 0}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
