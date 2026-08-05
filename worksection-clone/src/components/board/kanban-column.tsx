"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { TaskStatus } from "@/generated/prisma/enums";
import type { BoardTask } from "./types";
import { TaskCard } from "./task-card";
import { TASK_STATUS_LABEL, TASK_STATUS_DOT } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  status,
  tasks,
  onAdd,
}: {
  status: TaskStatus;
  tasks: BoardTask[];
  onAdd: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column", status } });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("size-2.5 rounded-full", TASK_STATUS_DOT[status])} />
        <span className="text-sm font-medium">{TASK_STATUS_LABEL[status]}</span>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
        <button
          onClick={() => onAdd(status)}
          className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
          title="Добавить задачу"
        >
          +
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-xl bg-muted/40 p-2 transition-colors",
          isOver && "bg-accent/60 ring-2 ring-primary/30",
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <button
            onClick={() => onAdd(status)}
            className="rounded-lg border border-dashed py-6 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            + Добавить задачу
          </button>
        )}
      </div>
    </div>
  );
}
