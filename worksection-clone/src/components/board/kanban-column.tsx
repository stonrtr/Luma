"use client";

import { t } from "@/lib/i18n";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronLeft, Plus } from "lucide-react";
import type { BoardTask } from "./types";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";

// Универсальная колонка доски (используется и канбаном по статусам, и «По днях» по датам)
export function KanbanColumn({
  id,
  label,
  dotClass,
  tasks,
  collapsed,
  onToggle,
  onAdd,
  showStatus,
  locale = "uk",
}: {
  id: string;
  label: string;
  dotClass: string;
  tasks: BoardTask[];
  collapsed: boolean;
  onToggle: (id: string) => void;
  onAdd?: (id: string) => void;
  showStatus?: boolean;
  locale?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "column", id } });

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        onClick={() => onToggle(id)}
        title={t(locale, "kc.expand")}
        className={cn(
          "flex w-11 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl bg-muted/40 py-2 transition-colors hover:bg-muted",
          isOver && "bg-accent/60 ring-2 ring-primary/30",
        )}
      >
        <ChevronLeft className="size-4 text-muted-foreground" />
        <span className={cn("size-2.5 rounded-full", dotClass)} />
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
        <span className="text-sm font-medium [writing-mode:vertical-rl]">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex w-96 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <button onClick={() => onToggle(id)} title={t(locale, "kc.collapse")} className="text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown className="size-4" />
        </button>
        <span className={cn("size-2.5 rounded-full", dotClass)} />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
        {onAdd && (
          <button
            onClick={() => onAdd(id)}
            className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
            title={t(locale, "kc.addTask")}
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 rounded-xl bg-muted/40 p-2 transition-colors",
          isOver && "bg-accent/60 ring-2 ring-primary/30",
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} showStatus={showStatus} locale={locale} />
          ))}
        </SortableContext>
        {tasks.length === 0 && onAdd && (
          <button
            onClick={() => onAdd(id)}
            className="rounded-lg border border-dashed py-6 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            + Додати задачу
          </button>
        )}
      </div>
    </div>
  );
}
