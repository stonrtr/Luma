import Link from "next/link";
import type { BoardTask } from "./types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_STATUS_DOT,
  priorityTone,
} from "@/lib/domain";
import { initials, formatShortDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TaskList({ tasks }: { tasks: BoardTask[] }) {
  return (
    <div className="space-y-6">
      {TASK_STATUSES.map((status) => {
        const rows = tasks.filter((t) => t.status === status);
        if (rows.length === 0) return null;
        return (
          <div key={status}>
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <span className={cn("size-2.5 rounded-full", TASK_STATUS_DOT[status])} />
              <span className="text-sm font-medium">{TASK_STATUS_LABEL[status]}</span>
              <span className="text-xs text-muted-foreground">{rows.length}</span>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              {rows.map((t, i) => (
                <Link
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50",
                    i > 0 && "border-t",
                  )}
                >
                  <span className="flex-1 truncate font-medium">{t.title}</span>
                  {t.checklistTotal > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t.checklistDone}/{t.checklistTotal}
                    </span>
                  )}
                  <span
                    className="flex size-[19px] shrink-0 items-center justify-center rounded-full border-[1.25px] bg-transparent text-[10px] font-semibold"
                    style={{ color: priorityTone(t.priority), borderColor: priorityTone(t.priority) }}
                    title={`Пріоритет ${t.priority}`}
                  >
                    {t.priority}
                  </span>
                  <span
                    className={cn(
                      "w-20 shrink-0 text-right text-xs",
                      t.dueDate && isOverdue(t.dueDate) && t.status !== "DONE"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {t.dueDate ? formatShortDate(t.dueDate) : "—"}
                  </span>
                  <span className="flex w-16 shrink-0 justify-end -space-x-1.5">
                    {t.assignees.map((a) => (
                      <Avatar key={a.id} className="size-6 border-2 border-card">
                        {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt={a.name} />}
                        <AvatarFallback className="text-[9px]">{initials(a.name)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
