"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Circle, CheckCircle2, Clock, Repeat } from "lucide-react";
import type { BoardTask } from "@/components/board/types";
import { priorityStyle } from "@/lib/domain";
import { plannedLabel } from "@/lib/domain";
import { toggleLifeTaskDone } from "@/server/actions/life";
import { cn } from "@/lib/utils";

function pluralDays(n: number): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

function dueBadge(dueISO: string, done: boolean): { text: string; cls: string } | null {
  const due = new Date(dueISO); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  const soon = "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
  if (diff < 0) {
    if (done) return null;
    const n = Math.abs(diff);
    return { text: `${n} ${pluralDays(n)} назад`, cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
  }
  if (diff === 0) return { text: "сегодня", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" };
  if (diff === 1) return { text: "завтра", cls: soon };
  return { text: `${diff} ${pluralDays(diff)}`, cls: soon };
}

// Карточка личной задачи: чекбокс «готово» слева, срок/приоритет справа. Перетаскивается между сферами.
export function LifeTaskCard({ task, isRecurring }: { task: BoardTask; isRecurring?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });
  const [pending, start] = useTransition();

  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const done = task.status === "DONE";
  const badge = task.dueDate ? dueBadge(task.dueDate, done) : null;
  const overdue = !!(!done && task.dueDate && new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0));

  function toggle() {
    start(async () => { await toggleLifeTaskDone({ taskId: task.id, done: !done }); });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md",
        overdue && "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
        pending && "opacity-60",
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggle(); }}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={pending}
        className={cn("flex h-6 shrink-0 items-center transition-colors", done ? "text-emerald-600" : "text-muted-foreground/40 hover:text-emerald-600")}
        title={done ? "Вернуть в работу" : "Отметить выполнено"}
      >
        {done ? <CheckCircle2 className="size-[17px]" /> : <Circle className="size-[17px]" />}
      </button>

      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks/${task.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn("block break-words text-sm font-medium leading-6 hover:text-primary", done && "text-muted-foreground line-through")}
        >
          {task.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {badge && <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", badge.cls)}>{badge.text}</span>}
          {task.plannedMinutes ? (
            <span className="flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              <Clock className="size-3" />{plannedLabel(task.plannedMinutes)}
            </span>
          ) : null}
          {isRecurring && (
            <span className="flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-700 dark:bg-violet-950 dark:text-violet-300" title="Повторяющаяся">
              <Repeat className="size-3" />
            </span>
          )}
          <span
            className={cn("ml-auto flex size-5 items-center justify-center rounded text-[11px] font-semibold", priorityStyle(task.priority))}
            title={`Приоритет ${task.priority}`}
          >
            {task.priority}
          </span>
        </div>
      </div>
    </div>
  );
}
