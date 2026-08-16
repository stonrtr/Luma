"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TaskStatus } from "@/generated/prisma/enums";
import { updateTask } from "@/server/actions/tasks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_STYLE, TASK_STATUS_DOT, PRIORITY_VALUES, priorityStyle, priorityTone } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function StatusPopover({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const router = useRouter();
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  function pick(s: TaskStatus) {
    setOpen(false);
    if (s === status) return;
    start(async () => {
      await updateTask({ taskId, status: s });
      toast.success(tr("ic.statusUpdated"));
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80", TASK_STATUS_STYLE[status])}>
        {tr(`status.${status}`)}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {TASK_STATUSES.map((s) => (
          <button key={s} onClick={() => pick(s)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted", s === status && "bg-muted")}>
            <span className={cn("size-2.5 rounded-full", TASK_STATUS_DOT[s])} />
            {tr(`status.${s}`)}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function PriorityPopover({ taskId, priority }: { taskId: string; priority: number }) {
  const router = useRouter();
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  function pick(p: number) {
    setOpen(false);
    if (p === priority) return;
    start(async () => {
      await updateTask({ taskId, priority: p });
      toast.success(tr("ic.priorityUpdated"));
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex size-6 items-center justify-center rounded-full border-[1.25px] bg-transparent text-[11px] font-semibold transition-opacity hover:opacity-80" style={{ color: priorityTone(priority), borderColor: priorityTone(priority) }} title={tr("ic.changePriority")}>
        {priority}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <p className="mb-1.5 text-xs text-muted-foreground">{tr("common.priority")}</p>
        <div className="flex gap-1">
          {PRIORITY_VALUES.map((p) => (
            <button key={p} onClick={() => pick(p)} className={cn("flex size-7 items-center justify-center rounded text-xs font-medium transition-all", p === priority ? cn(priorityStyle(p), "ring-2 ring-ring ring-offset-1") : "border text-muted-foreground hover:bg-muted")}>
              {p}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
