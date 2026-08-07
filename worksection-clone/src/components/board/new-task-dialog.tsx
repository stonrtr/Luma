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

const pad = (n: number) => String(n).padStart(2, "0");
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function NewTaskDialog({
  projectId,
  members,
  status,
  onClose,
  lockedAssigneeId,
  defaultAssigneeId,
  projects,
  initialTitle,
  initialStatus,
  initialDueDate,
  headerTitle,
  cancelLabel,
  extraFooter,
  onCreated,
}: {
  projectId: string;
  members: BoardMember[];
  status: TaskStatus | null;
  onClose: () => void;
  lockedAssigneeId?: string;
  defaultAssigneeId?: string;
  projects?: { id: string; name: string; color: string }[];
  initialTitle?: string;
  initialStatus?: TaskStatus;
  initialDueDate?: string;
  headerTitle?: string;
  cancelLabel?: string;
  extraFooter?: React.ReactNode;
  onCreated?: (taskId: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [priority, setPriority] = useState<number>(DEFAULT_PRIORITY);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(initialStatus ?? "TODO");
  const [plannedMinutes, setPlannedMinutes] = useState<number>(30);
  const [assigneeId, setAssigneeId] = useState<string>(defaultAssigneeId ?? members[0]?.id ?? "");
  const [projectSel, setProjectSel] = useState<string>("base");
  const [dueDate, setDueDate] = useState(initialDueDate ?? todayStr());
  const [dueTime] = useState("");

  // выбор проекта показываем только в личном контексте (нет жёсткого проекта) и если проекты есть
  const showProjectSelect = !projectId && !!projects && projects.length > 0;

  function reset() {
    setTitle("");
    setPriority(DEFAULT_PRIORITY);
    setTaskStatus("TODO");
    setPlannedMinutes(30);
    setAssigneeId(defaultAssigneeId ?? members[0]?.id ?? "");
    setProjectSel("base");
    setDueDate(initialDueDate ?? todayStr());
  }

  function submit() {
    if (!title.trim()) {
      toast.error("Введіть назву задачі");
      return;
    }
    start(async () => {
      try {
        const created = await createTask({
          projectId: showProjectSelect
            ? (projectSel === "base" ? undefined : projectSel)
            : (projectId || undefined),
          title: title.trim(),
          status: taskStatus,
          priority,
          plannedMinutes,
          assigneeId: lockedAssigneeId ?? (assigneeId || undefined),
          dueDate: dueDate || undefined,
          dueTime: dueTime || undefined,
        });
        toast.success("Задачу створено");
        if (onCreated) {
          onCreated(created.id);
        } else {
          reset();
          onClose();
          router.refresh();
        }
      } catch {
        toast.error("Не вдалося створити задачу");
      }
    });
  }

  return (
    <Dialog open={status !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}>
        <DialogHeader>
          <DialogTitle>{headerTitle ?? "Нова задача"}</DialogTitle>
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

          {showProjectSelect && (
            <div className="space-y-1.5">
              <Label>Проєкт</Label>
              <Select value={projectSel} onValueChange={setProjectSel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Ні</SelectItem>
                  {projects!.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Плановое время */}
          <div className="space-y-1.5">
            <Label>Запланований час</Label>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-due">Дедлайн</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            {!lockedAssigneeId && (
              <div className="space-y-2">
                <Label>Виконавець</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}{m.isActive === false ? " · закритий" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Дата — це дедлайн задачі.</p>
        </div>
        <DialogFooter className="sm:flex-col sm:items-stretch sm:gap-2">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>{cancelLabel ?? "Скасувати"}</Button>
            {extraFooter}
            <Button onClick={submit} disabled={pending}>{pending ? "Створення…" : "Створити"}</Button>
          </div>
          <span className="text-right text-[10px] text-muted-foreground">⌘/Ctrl + Enter — створити</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
