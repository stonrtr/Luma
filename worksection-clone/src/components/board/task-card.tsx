"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Circle, CheckCircle2 } from "lucide-react";
import type { BoardTask } from "./types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { priorityStyle } from "@/lib/domain";
import { initials } from "@/lib/format";
import { useSelection } from "./selection-context";
import { cn } from "@/lib/utils";

function pluralDays(n: number): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дні";
  return "днів";
}

function dueBadge(dueISO: string, done: boolean): { text: string; cls: string } | null {
  const due = new Date(dueISO); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  const soon = "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
  if (diff < 0) {
    if (done) return null;
    const n = Math.abs(diff);
    return { text: `${n} ${pluralDays(n)} тому`, cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
  }
  if (diff === 0) return { text: "сьогодні", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" };
  return { text: `${diff} ${pluralDays(diff)}`, cls: soon };
}

export function TaskCard({ task }: { task: BoardTask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const done = task.status === "DONE";
  const badge = task.dueDate ? dueBadge(task.dueDate, done) : null;
  const sel = useSelection();
  const selected = sel?.selected.has(task.id) ?? false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md",
        task.assignedByManager && "border-l-4 border-l-primary",
        selected && "ring-2 ring-primary",
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); sel?.toggle(task.id); }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn("shrink-0 transition-colors", selected ? "text-primary" : "text-muted-foreground/40 hover:text-primary")}
        title="Виділити задачу"
      >
        {selected ? <CheckCircle2 className="size-[15px]" /> : <Circle className="size-[15px]" />}
      </button>

      {task.isProject && <span className="size-2 shrink-0 rounded-full bg-indigo-500" title="Проєктна задача" />}

      <Link
        href={`/tasks/${task.id}`}
        onClick={(e) => e.stopPropagation()}
        className={cn("min-w-0 flex-1 truncate text-sm font-medium hover:text-primary", done && "text-muted-foreground line-through")}
      >
        {task.title}
      </Link>

      {badge && (
        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium", badge.cls)}>{badge.text}</span>
      )}

      <span
        className={cn("flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold", priorityStyle(task.priority))}
        title={`Пріоритет ${task.priority}`}
      >
        {task.priority}
      </span>

      <div className="flex shrink-0 -space-x-1.5">
        {task.assignees.map((a) => (
          <Avatar key={a.id} className="size-6 border-2 border-card">
            <AvatarFallback className="text-[9px]">{initials(a.name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
    </div>
  );
}
