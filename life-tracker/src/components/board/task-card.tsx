"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Circle, CheckCircle2, User } from "lucide-react";
import type { BoardTask } from "./types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { priorityTone, TASK_STATUS_STYLE } from "@/lib/domain";
import { initials } from "@/lib/format";
import { t, taskStatusLabel } from "@/lib/i18n";
import { useSelection } from "./selection-context";
import { cn } from "@/lib/utils";

function dueBadge(dueISO: string, done: boolean, locale: string): { text: string; cls: string } | null {
  const due = new Date(dueISO); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  const soon = "bg-[#DCEAF6] text-[#2C5E7A] dark:bg-[#132a36] dark:text-[#8fc6e2]";
  const d = t(locale, "due.d");
  if (diff < 0) {
    if (done) return null;
    return { text: `${Math.abs(diff)} ${d} ${t(locale, "due.ago")}`, cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
  }
  if (diff === 0) return { text: t(locale, "due.today"), cls: "bg-[#FBE6D6] text-[#A0561F] dark:bg-[#33210f] dark:text-[#e2b382]" };
  return { text: `${diff} ${d}`, cls: soon };
}

export function TaskCard({ task, showStatus, locale = "uk" }: { task: BoardTask; showStatus?: boolean; locale?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const done = task.status === "DONE";
  const badge = task.dueDate ? dueBadge(task.dueDate, done, locale) : null;
  const overdue = !!(!done && task.dueDate && new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0));
  const sel = useSelection();
  const selected = sel?.selected.has(task.id) ?? false;
  const selectionActive = (sel?.selected.size ?? 0) > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (selectionActive) sel?.toggle(task.id); }}
      className={cn(
        "group flex flex-col gap-1 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md",
        task.assignedByManager && "border-l-4 border-l-amber-500",
        overdue && "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
        selected && "ring-2 ring-primary",
        selectionActive && "cursor-pointer",
      )}
    >
      {/* Первая строка: чекбокс, назва, срок, пріоритет, аватар — на одной линии */}
      <div className="flex items-start gap-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); sel?.toggle(task.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn("flex h-6 shrink-0 items-center transition-colors", selected ? "text-accent-foreground" : "text-muted-foreground/40 hover:text-accent-foreground")}
          title={t(locale, "tc.selectTask")}
        >
          {selected ? <CheckCircle2 className="size-[15px]" /> : <Circle className="size-[15px]" />}
        </button>

        <Link
          href={`/tasks/${task.id}`}
          onClick={(e) => { if (selectionActive) { e.preventDefault(); e.stopPropagation(); sel?.toggle(task.id); } }}
          className={cn("min-w-0 flex-1 break-words text-sm font-medium leading-6 hover:text-accent-foreground", done && "text-muted-foreground line-through")}
        >
          {task.title}
        </Link>

        <div className="flex h-6 shrink-0 items-center gap-2">
          {badge && (
            <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", badge.cls)}>{badge.text}</span>
          )}
          <span
            className="flex size-[19px] items-center justify-center rounded-full border-[1.25px] bg-transparent text-[10px] font-semibold"
            style={{ color: priorityTone(task.priority), borderColor: priorityTone(task.priority) }}
            title={`${t(locale, "common.priority")} ${task.priority}`}
          >
            {task.priority}
          </span>
          {task.assignees.length > 0 ? (
            <div className="flex -space-x-1.5">
              {task.assignees.map((a) => (
                <Avatar key={a.id} className="size-6 border-2 border-card" title={a.name}>
                  {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt={a.name} />}
                  <AvatarFallback className="text-[9px]">{initials(a.name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : (
            <span className="flex size-6 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground/40" title={t(locale, "tc.noAssignee")}>
              <User className="size-3" />
            </span>
          )}
        </div>
      </div>

      {/* Проект — под назвою */}
      {task.projectName && (
        <div className="flex items-center gap-1 pl-[25px] text-[11px] text-muted-foreground">
          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.projectColor ?? "#6366f1" }} />
          <span className="truncate">{task.projectName}</span>
        </div>
      )}

      {/* Нижний левый угол: «від керівника», «з самарі», далее — статус */}
      {(task.assignedByManager || task.fromSummary || showStatus) && (
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pl-[25px] pt-0.5">
          {task.assignedByManager && (
            <span className="rounded bg-[#FBE6D6] text-[#A0561F] dark:bg-[#33210f] dark:text-[#e2b382] px-1.5 py-0.5 text-[10px] font-medium">
              {t(locale, "filters.byManager")}
            </span>
          )}
          {task.fromSummary && (
            <span className="rounded bg-[#EDE7FA] text-[#5B47A6] dark:bg-[#241d3a] dark:text-[#c3b6f0] px-1.5 py-0.5 text-[10px] font-medium">
              {t(locale, "filters.fromSummary")}
            </span>
          )}
          {showStatus && (
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", TASK_STATUS_STYLE[task.status])}>
              {taskStatusLabel(locale, task.status)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
