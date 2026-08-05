"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare, ListChecks, GitBranch, Calendar, FolderKanban, Clock } from "lucide-react";
import type { BoardTask } from "./types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { priorityStyle, plannedLabel } from "@/lib/domain";
import { initials, formatShortDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TaskCard({ task }: { task: BoardTask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        task.assignedByManager && "border-l-4 border-l-primary ring-1 ring-primary/20",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={`/tasks/${task.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium leading-snug hover:text-primary"
        >
          {task.title}
        </Link>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold",
            priorityStyle(task.priority),
          )}
          title={`Пріоритет ${task.priority}`}
        >
          {task.priority}
        </span>
      </div>

      {(task.isProject || task.assignedByManager) && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.isProject && (
            <span className="inline-flex items-center gap-0.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              <FolderKanban className="size-3" /> Проєкт
            </span>
          )}
          {task.assignedByManager && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Від керівника
            </span>
          )}
        </div>
      )}

      {task.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.tags.map((t) => (
            <span
              key={t.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${t.color}22`, color: t.color }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {task.checklistTotal > 0 && (
            <span className="flex items-center gap-0.5">
              <ListChecks className="size-3.5" />
              {task.checklistDone}/{task.checklistTotal}
            </span>
          )}
          {task.subtaskCount > 0 && (
            <span className="flex items-center gap-0.5">
              <GitBranch className="size-3.5" />
              {task.subtaskCount}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="size-3.5" />
              {task.commentCount}
            </span>
          )}
          {task.plannedMinutes != null && (
            <span className="flex items-center gap-0.5">
              <Clock className="size-3.5" />
              {plannedLabel(task.plannedMinutes)}
            </span>
          )}
          {task.dueDate && (
            <span className={cn("flex items-center gap-0.5", isOverdue(task.dueDate) && task.status !== "DONE" && "text-destructive")}>
              <Calendar className="size-3.5" />
              {formatShortDate(task.dueDate)}
            </span>
          )}
        </div>

        <div className="flex -space-x-1.5">
          {task.assignees.map((a) => (
            <Avatar key={a.id} className="size-6 border-2 border-card">
              <AvatarFallback className="text-[9px]">{initials(a.name)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>
    </div>
  );
}
