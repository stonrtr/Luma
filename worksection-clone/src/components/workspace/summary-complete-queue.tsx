"use client";
import { useT, useLocale } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSummaryTask } from "@/server/actions/calls";
import type { SummaryPrefill } from "@/lib/summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PRIORITY_VALUES, DEFAULT_PRIORITY, priorityStyle, PLANNED_MINUTES, plannedLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Очередь неполных задач импорта: для каждой спрашиваем ТОЛЬКО отсутствующие поля.
export function SummaryCompleteQueue({ tasks, onFinish }: { tasks: SummaryPrefill[]; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const tr = useT();
  const task = tasks[index];
  if (!task) return null;
  const next = () => (index + 1 >= tasks.length ? onFinish() : setIndex(index + 1));
  return <CompleteOne key={index} task={task} i={index} total={tasks.length} onDone={next} onStop={onFinish} />;
}

function CompleteOne({
  task, i, total, onDone, onStop,
}: { task: SummaryPrefill; i: number; total: number; onDone: () => void; onStop: () => void }) {
  const router = useRouter();
  const tr = useT();
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [priority, setPriority] = useState<number>(task.priority ?? DEFAULT_PRIORITY);
  const [dueDate, setDueDate] = useState<string>(task.dueDate ?? todayStr());
  const [planned, setPlanned] = useState<number>(task.plannedMinutes ?? 30);

  const needPriority = task.priority == null;
  const needDue = task.dueDate == null;
  const needPlanned = task.plannedMinutes == null;

  function submit() {
    start(async () => {
      const res = await createSummaryTask({ title: task.title, priority, dueDate, plannedMinutes: planned });
      if (res.error) { toast.error(res.error); return; }
      toast.success(tr("sq.taskCreated"));
      router.refresh();
      onDone();
    });
  }

  // уже известные параметры показываем справкой, не переспрашивая
  const known: string[] = [];
  if (!needPriority) known.push(`Пріоритет ${task.priority}`);
  if (!needDue && task.dueDate) known.push(`Дедлайн ${task.dueDate.split("-").reverse().join(".")}`);
  if (!needPlanned && task.plannedMinutes) known.push(plannedLabel(task.plannedMinutes, locale));

  return (
    <Dialog open onOpenChange={(o) => !o && onStop()}>
      <DialogContent className="sm:max-w-md" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}>
        <DialogHeader>
          <DialogTitle>{tr("sq.taskWord")} {i + 1} {tr("sq.ofWord")} {total}: {tr("sq.fillTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">{task.title}</p>
            {known.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{known.join(" · ")}</p>}
          </div>

          {needPriority && (
            <div className="space-y-1.5">
              <Label>{tr("common.priority")}</Label>
              <div className="flex gap-1">
                {PRIORITY_VALUES.map((p) => (
                  <button
                    key={p} type="button" onClick={() => setPriority(p)}
                    className={cn(
                      "flex h-8 flex-1 items-center justify-center rounded-md border text-sm font-medium transition-all",
                      priority === p ? cn(priorityStyle(p), "border-transparent ring-2 ring-offset-1 ring-ring") : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needPlanned && (
            <div className="space-y-1.5">
              <Label>{tr("common.plannedTime")}</Label>
              <div className="flex gap-2">
                {PLANNED_MINUTES.map((m) => (
                  <button
                    key={m} type="button" onClick={() => setPlanned(m)}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-1.5 text-sm font-medium transition-all",
                      planned === m ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {plannedLabel(m, locale)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needDue && (
            <div className="space-y-2">
              <Label htmlFor="sum-due">{tr("common.deadline")}</Label>
              <Input id="sum-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onStop} disabled={pending}>{tr("sq.stop")}</Button>
            <Button onClick={submit} disabled={pending}>{pending ? tr("common.creating") : tr("admin.create")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
