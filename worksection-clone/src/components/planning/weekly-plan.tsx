"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ListChecks, Plus, X, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import type { TaskStatus } from "@/generated/prisma/enums";
import { addPlanItem, addExistingTaskToPlan, deletePlanItem, approvePlan } from "@/server/actions/planning";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PRIORITY_VALUES, DEFAULT_PRIORITY, priorityStyle, TASK_STATUS_LABEL, TASK_STATUS_STYLE } from "@/lib/domain";
import { isoWeekNumber } from "@/lib/week";
import { cn } from "@/lib/utils";

type Item = {
  id: string; title: string; priority: number; approved: boolean;
  projectId: string | null; task: { id: string; status: TaskStatus } | null;
};
type Project = { id: string; name: string; color: string };
type AvailableTask = { id: string; title: string; priority: number };

const MIN_SLOTS = 3;

export function WeeklyPlan({
  userId, weekStart, items, projects, availableTasks, canEdit,
}: {
  userId: string; weekStart: string; items: Item[]; projects: Project[]; availableTasks: AvailableTask[]; canEdit: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [projectId, setProjectId] = useState("none");
  const [taskId, setTaskId] = useState("");
  const [pending, start] = useTransition();

  const unapproved = items.filter((i) => !i.approved).length;
  const emptySlots = Math.max(0, MIN_SLOTS - items.length);
  const weekNo = isoWeekNumber(new Date(weekStart));

  function add() {
    if (!title.trim()) return;
    const t = title.trim();
    setTitle("");
    start(async () => {
      const res = await addPlanItem({ userId, weekStart, title: t, priority, projectId: projectId === "none" ? undefined : projectId });
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }

  function addExisting() {
    if (!taskId) { toast.error("Оберіть задачу"); return; }
    const id = taskId;
    setTaskId("");
    start(async () => {
      const res = await addExistingTaskToPlan({ userId, weekStart, taskId: id });
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks className="size-4 text-primary" /> Пріоритети тижня №{weekNo}
          <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
        </h3>
        {canEdit && unapproved > 0 && (
          <Button size="sm" onClick={() => start(async () => { await approvePlan({ userId, weekStart }); toast.success("План затверджено — задачі створено"); router.refresh(); })} disabled={pending}>
            <CheckCheck className="size-4" /> Затвердити ({unapproved})
          </Button>
        )}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">Заплануйте щонайменше {MIN_SLOTS} ключові задачі на тиждень за пріоритетом.</p>

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <span className={cn("flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold", priorityStyle(item.priority))}>
              {item.priority}
            </span>
            {item.task ? (
              <Link href={`/tasks/${item.task.id}`} className="flex-1 text-sm hover:text-primary">{item.title}</Link>
            ) : (
              <span className="flex-1 text-sm">{item.title}</span>
            )}
            {item.approved && item.task ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", TASK_STATUS_STYLE[item.task.status])}>
                {TASK_STATUS_LABEL[item.task.status]}
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">чернетка</span>
            )}
            {canEdit && !item.approved && (
              <button onClick={() => start(async () => { await deletePlanItem(item.id); router.refresh(); })} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100">
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {/* пустые слоты-заготовки до минимума */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <li key={`slot-${i}`} className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground">{items.length + i + 1}</span>
            Порожній слот — додайте задачу
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-3 space-y-2 rounded-lg border border-dashed p-3">
          <div className="flex gap-1">
            <button type="button" onClick={() => setMode("create")} className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors", mode === "create" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              Створити нову
            </button>
            <button type="button" onClick={() => setMode("existing")} className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors", mode === "existing" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              Обрати наявну
            </button>
          </div>

          {mode === "create" ? (
            <>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Ключова задача тижня…" className="h-8" />
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-0.5">
                  {PRIORITY_VALUES.map((p) => (
                    <button key={p} type="button" onClick={() => setPriority(p)}
                      className={cn("flex size-6 items-center justify-center rounded text-[11px] font-medium transition-all",
                        priority === p ? cn(priorityStyle(p), "ring-1 ring-ring ring-offset-1") : "border text-muted-foreground hover:bg-muted")}>
                      {p}
                    </button>
                  ))}
                </div>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Проєкт" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без проєкту</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button onClick={add} disabled={pending} className="flex size-8 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-50"><Plus className="size-4" /></button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {availableTasks.length > 0 ? (
                <>
                  <Select value={taskId} onValueChange={setTaskId}>
                    <SelectTrigger className="h-8 min-w-0 flex-1"><SelectValue placeholder="Оберіть задачу…" /></SelectTrigger>
                    <SelectContent>
                      {availableTasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("flex size-4 items-center justify-center rounded text-[9px] font-semibold", priorityStyle(t.priority))}>{t.priority}</span>
                            {t.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button onClick={addExisting} disabled={pending} className="flex size-8 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-50"><Plus className="size-4" /></button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Немає наявних задач для вибору.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
