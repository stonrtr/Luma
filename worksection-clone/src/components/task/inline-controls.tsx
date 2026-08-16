"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TaskStatus } from "@/generated/prisma/enums";
import { updateTask } from "@/server/actions/tasks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_STYLE, TASK_STATUS_DOT, PRIORITY_VALUES, priorityStyle, priorityTone, PLANNED_MINUTES, plannedLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/format";

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


// Инлайн-редактор дедлайна: клик по дате в шапке задачи → date-input + «очистить».
export function DueDatePopover({ taskId, dueDate, locale, overdue }: { taskId: string; dueDate: string | null; locale: string; overdue: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const tr = (k: string) => t(locale, k);
  const val = dueDate ? new Date(dueDate) : null;
  const inputVal = val ? `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, "0")}-${String(val.getDate()).padStart(2, "0")}` : "";
  const save = (v: string | null) => start(async () => {
    await updateTask({ taskId, dueDate: v });
    setOpen(false); router.refresh();
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={overdue ? "font-medium text-red-600 underline decoration-dotted underline-offset-4 hover:opacity-80" : "text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"}
        title={tr("ic.changeDue")}
      >
        {val ? formatDate(val, locale) : tr("task.noDue")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <input
          type="date"
          defaultValue={inputVal}
          onChange={(e) => e.target.value && save(e.target.value)}
          className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ring"
        />
        {val && (
          <button onClick={() => save(null)} className="mt-1.5 w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted">
            {tr("ic.clearDue")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Инлайн-редактор запланированного времени: варианты как при создании задачи.
export function PlannedPopover({ taskId, plannedMinutes, locale }: { taskId: string; plannedMinutes: number | null; locale: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const tr = (k: string) => t(locale, k);
  const save = (m: number | null) => start(async () => {
    await updateTask({ taskId, plannedMinutes: m });
    setOpen(false); router.refresh();
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground" title={tr("ic.changePlanned")}>
        {plannedMinutes ? plannedLabel(plannedMinutes, locale) : tr("task.noPlanned")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-36 p-1">
        {PLANNED_MINUTES.map((m) => (
          <button key={m} onClick={() => save(m)}
            className={"flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted " + (plannedMinutes === m ? "font-semibold" : "")}>
            {plannedLabel(m, locale)}
          </button>
        ))}
        {plannedMinutes != null && (
          <button onClick={() => save(null)} className="mt-0.5 flex w-full items-center rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted">
            {tr("ic.clearPlanned")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}


// Инлайн-редактор старта (дата + время) — для календаря.
export function StartAtPopover({ taskId, scheduledAt, locale }: { taskId: string; scheduledAt: string | null; locale: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const tr = (k: string) => t(locale, k);
  const val = scheduledAt ? new Date(scheduledAt) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateVal = val ? `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}` : "";
  const timeVal = val ? `${pad(val.getHours())}:${pad(val.getMinutes())}` : "";
  const [d, setD] = useState(dateVal);
  const [tm, setTm] = useState(timeVal);
  const save = (dv: string, tv: string) => {
    if (!dv) return;
    start(async () => {
      await updateTask({ taskId, scheduledAt: tv ? `${dv}T${tv}` : dv });
      setOpen(false); router.refresh();
    });
  };
  const clear = () => start(async () => { await updateTask({ taskId, scheduledAt: null }); setOpen(false); router.refresh(); });
  const label = val ? `${formatDate(val, locale)}${timeVal !== "00:00" ? ` ${timeVal}` : ""}` : tr("task.noStart");
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setD(dateVal); setTm(timeVal); } }}>
      <PopoverTrigger className="text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground" title={tr("ic.changeStart")}>
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 space-y-1.5 p-2">
        <input type="date" value={d} onChange={(e) => setD(e.target.value)}
          className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ring" />
        <input type="time" value={tm} onChange={(e) => setTm(e.target.value)}
          className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ring" />
        <div className="flex items-center gap-1.5 pt-0.5">
          <button onClick={() => save(d, tm)} disabled={!d}
            className="flex-1 rounded-md border border-primary bg-accent px-2 py-1 text-xs font-medium text-accent-foreground disabled:opacity-50">
            OK
          </button>
          {val && (
            <button onClick={clear} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
              {tr("ic.clearStart")}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
