"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TaskStatus } from "@/generated/prisma/enums";
import type { BoardMember } from "./types";
import { createTask } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_VALUES,
  DEFAULT_PRIORITY,
  priorityStyle,
  PLANNED_MINUTES,
  plannedLabel,
  TASK_STATUS_LABEL,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

export function NewTaskDialog({
  projectId,
  members,
  status,
  onClose,
  lockedAssigneeId,
}: {
  projectId: string;
  members: BoardMember[];
  status: TaskStatus | null;
  onClose: () => void;
  lockedAssigneeId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<number>(DEFAULT_PRIORITY);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("TODO");
  const [plannedMinutes, setPlannedMinutes] = useState<number>(30);
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");

  function reset() {
    setTitle("");
    setPriority(DEFAULT_PRIORITY);
    setTaskStatus("TODO");
    setPlannedMinutes(30);
    setAssigneeId("none");
    setDueDate("");
    setDueTime("");
  }

  function submit() {
    if (!title.trim()) {
      toast.error("Введіть назву задачі");
      return;
    }
    start(async () => {
      try {
        await createTask({
          projectId: projectId || undefined,
          title: title.trim(),
          status: taskStatus,
          priority,
          plannedMinutes,
          assigneeId: lockedAssigneeId ?? (assigneeId === "none" ? undefined : assigneeId),
          dueDate: dueDate || undefined,
          dueTime: dueTime || undefined,
        });
        toast.success("Задачу створено");
        reset();
        onClose();
        router.refresh();
      } catch {
        toast.error("Не вдалося створити задачу");
      }
    });
  }

  return (
    <Dialog open={status !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Нова задача</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Назва</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Що потрібно зробити?"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          {/* Приоритет 1..10, 5 по центру, сразу активны */}
          <div className="space-y-1.5">
            <Label>Пріоритет</Label>
            <div className="flex gap-1">
              {PRIORITY_VALUES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex h-8 flex-1 items-center justify-center rounded-md border text-sm font-medium transition-all",
                    priority === p
                      ? cn(priorityStyle(p), "border-transparent ring-2 ring-offset-1 ring-ring")
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Статус: ідея / зробити */}
          <div className="space-y-1.5">
            <Label>Статус</Label>
            <div className="flex gap-2">
              {(["IDEA", "TODO"] as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTaskStatus(s)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-all",
                    taskStatus === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {TASK_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Плановое время */}
          <div className="space-y-1.5">
            <Label>Планований час</Label>
            <div className="flex gap-2">
              {PLANNED_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPlannedMinutes(m)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-sm font-medium transition-all",
                    plannedMinutes === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {plannedLabel(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-due">Дата</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-time">Час</Label>
              <Input id="task-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
            {!lockedAssigneeId && (
              <div className="space-y-2">
                <Label>Виконавець</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без виконавця</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Якщо вказати дату та час — задача з&apos;явиться в календарі.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Скасувати</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "Створення…" : "Створити"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
