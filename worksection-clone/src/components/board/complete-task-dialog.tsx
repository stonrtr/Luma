"use client";
import { useT } from "@/lib/locale-context";

import { useState } from "react";
import { toast } from "sonner";
import type { TaskStatus } from "@/generated/prisma/enums";
import { updateTask } from "@/server/actions/tasks";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PRIORITY_VALUES, PLANNED_MINUTES, priorityStyle, plannedLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

type MiniTask = { id: string; title: string; priority: number; plannedMinutes: number | null; dueDate: string | null };

// Попап «дозаповнення» задачі при перетягуванні з «Ідей» у робочий статус:
// пріоритет / запланований час / дедлайн обовʼязкові, незаповнені — підсвічені.
export function CompleteTaskDialog({
  task, targetStatus, locale, onCancel, onDone,
}: {
  task: MiniTask;
  targetStatus: TaskStatus;
  locale: string;
  onCancel: () => void;
  onDone: (fields: { priority: number; plannedMinutes: number; dueDate: string }) => void;
}) {
  const tr = useT();
  const [priority, setPriority] = useState<number>(task.priority ?? 5);
  const [planned, setPlanned] = useState<number>(task.plannedMinutes ?? 30);
  const [dueDate, setDueDate] = useState<string>(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [pending, setPending] = useState(false);
  const missingDue = !dueDate;

  async function save() {
    if (missingDue) { toast.error(tr("dlg.requiredMissing")); return; }
    setPending(true);
    try {
      await updateTask({ taskId: task.id, status: targetStatus, priority, plannedMinutes: planned, dueDate });
      onDone({ priority, plannedMinutes: planned, dueDate });
    } catch {
      toast.error(tr("dlg.createFailed"));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("dlg.completeTitle")}</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-xs text-muted-foreground">{tr("dlg.completeHint")}</p>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium">{task.title}</div>

          {/* Пріоритет */}
          <div className="space-y-1.5">
            <Label>{tr("dlg.priority")}<span className="ml-0.5 text-[#8CC63F]">*</span></Label>
            <div className="flex gap-1">
              {PRIORITY_VALUES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn("flex h-8 flex-1 items-center justify-center rounded-md border text-sm font-medium transition-all",
                    priority === p ? cn(priorityStyle(p), "border-transparent ring-2 ring-offset-1 ring-ring") : "border-border text-muted-foreground hover:bg-muted")}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Запланований час */}
          <div className="space-y-1.5">
            <Label>{tr("dlg.plannedTime")}<span className="ml-0.5 text-[#8CC63F]">*</span></Label>
            <div className="flex gap-2">
              {PLANNED_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPlanned(m)}
                  className={cn("flex-1 rounded-md border px-2 py-1.5 text-sm font-medium transition-all",
                    planned === m ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  {plannedLabel(m, locale)}
                </button>
              ))}
            </div>
          </div>

          {/* Дедлайн — підсвічуємо, якщо не заповнено */}
          <div className="space-y-1.5">
            <Label htmlFor="ct-due">{tr("dlg.deadline")}<span className="ml-0.5 text-[#8CC63F]">*</span></Label>
            <Input
              id="ct-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={cn(missingDue && "border-[#8CC63F] ring-2 ring-[#8CC63F]/40")}
            />
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            <span className="text-[#8CC63F]">*</span> {tr("dlg.requiredNote")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>{tr("dlg.cancel")}</Button>
          <Button onClick={save} disabled={pending}>{pending ? "…" : tr("dlg.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
