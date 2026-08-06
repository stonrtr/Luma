"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isPast, isToday } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PriorityBadge } from "@/components/task/priority-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDaysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BoardTask } from "@/components/board/types";

export function TaskCard({
  task,
  selected = false,
  onToggleSelected,
  showAssignee = true,
  hasSelection = false,
  draggable = true,
}: {
  task: BoardTask;
  selected?: boolean;
  onToggleSelected?: (taskId: string, checked: boolean) => void;
  showAssignee?: boolean;
  hasSelection?: boolean;
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !draggable });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const overdue =
    task.dueDate &&
    task.status !== "DONE" &&
    isPast(task.dueDate) &&
    !isToday(task.dueDate);

  const checkboxVisible = selected || hasSelection;

  return (
    <Card
      ref={draggable ? setNodeRef : undefined}
      style={draggable ? style : undefined}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      className={cn(
        "group py-3",
        draggable && "cursor-grab touch-none active:cursor-grabbing",
      )}
    >
      <div className="flex items-start px-3">
        {onToggleSelected && (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) =>
              onToggleSelected(task.id, checked === true)
            }
            onPointerDown={(event) => event.stopPropagation()}
            aria-label="Выбрать задачу"
            className={cn(
              "mt-0.5 shrink-0 transition-[width,opacity]",
              checkboxVisible
                ? "mr-1.5 w-4 opacity-100"
                : "mr-0 w-0 opacity-0 group-hover:mr-1.5 group-hover:w-4 group-hover:opacity-100",
            )}
          />
        )}
        <Link
          href={`/tasks/${task.id}`}
          className="min-w-0 flex-1"
          onClick={(event) => {
            if (hasSelection && onToggleSelected) {
              event.preventDefault();
              onToggleSelected(task.id, !selected);
            }
          }}
        >
          <span className="float-right ml-1.5 flex shrink-0 items-center gap-1.5 py-0.5">
            {task.dueDate && (
              <Badge variant={overdue ? "destructive" : "outline"} className="shrink-0">
                {formatDaysUntil(task.dueDate)}
              </Badge>
            )}
            <PriorityBadge priority={task.priority} taskId={task.id} editable />
            {showAssignee && (
              <UserAvatar
                name={task.assignee.name}
                avatarUrl={task.assignee.avatarUrl}
                className="shrink-0"
              />
            )}
          </span>
          <span className="text-sm font-medium">{task.title}</span>
        </Link>
      </div>
    </Card>
  );
}
