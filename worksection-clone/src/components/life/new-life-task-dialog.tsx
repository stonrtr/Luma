"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createLifeTask } from "@/server/actions/life";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_VALUES, DEFAULT_PRIORITY, priorityStyle, PLANNED_MINUTES, plannedLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { Sphere } from "./sphere-board";

const pad = (n: number) => String(n).padStart(2, "0");
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function NewLifeTaskDialog({
  projectId, spheres, defaultSphereId, onClose,
}: {
  projectId: string;
  spheres: Sphere[];
  defaultSphereId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [sphereId, setSphereId] = useState(defaultSphereId || spheres[0]?.id || "");
  const [priority, setPriority] = useState<number>(DEFAULT_PRIORITY);
  const [plannedMinutes, setPlannedMinutes] = useState<number>(30);
  const [dueDate, setDueDate] = useState(todayStr());

  function submit() {
    if (!title.trim()) { toast.error("Введите название задачи"); return; }
    if (!sphereId) { toast.error("Выберите сферу"); return; }
    start(async () => {
      try {
        await createLifeTask({
          projectId,
          sphereTagId: sphereId,
          title: title.trim(),
          priority,
          plannedMinutes,
          dueDate: dueDate || undefined,
        });
        toast.success("Задача создана");
        onClose();
        router.refresh();
      } catch {
        toast.error("Не удалось создать задачу");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}>
        <DialogHeader>
          <DialogTitle>Новая задача</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="life-title">Название</Label>
            <Input
              id="life-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Что нужно сделать?"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Сфера жизни</Label>
            <Select value={sphereId} onValueChange={setSphereId}>
              <SelectTrigger><SelectValue placeholder="Выберите сферу" /></SelectTrigger>
              <SelectContent>
                {spheres.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Приоритет</Label>
            <div className="flex gap-1">
              {PRIORITY_VALUES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
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

          <div className="space-y-1.5">
            <Label>Запланированное время</Label>
            <div className="flex gap-2">
              {PLANNED_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPlannedMinutes(m)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-sm font-medium transition-all",
                    plannedMinutes === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {plannedLabel(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="life-due">Дата (дедлайн)</Label>
            <Input id="life-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">По дате задача попадает в «Сегодня / Неделю / Месяц». Пусто — «Когда-нибудь».</p>
          </div>
        </div>
        <DialogFooter className="sm:flex-col sm:items-stretch sm:gap-2">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>Отмена</Button>
            <Button onClick={submit} disabled={pending}>{pending ? "Создание…" : "Создать"}</Button>
          </div>
          <span className="text-right text-[10px] text-muted-foreground">⌘/Ctrl + Enter — создать</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
