"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge } from "@/components/task/priority-badge";
import {
  createRecurringTask,
  deleteRecurringTask,
} from "@/server/actions/recurring";
import type { RecurringTask } from "@/generated/prisma/client";

const weekdayLabels = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

function describeFrequency(task: RecurringTask) {
  if (task.frequency === "DAILY") return "Каждый день";
  if (task.frequency === "WEEKLY") {
    return `Каждую неделю: ${weekdayLabels[task.weekday ?? 0]}`;
  }
  return `Каждый месяц: ${task.dayOfMonth} число`;
}

export function RecurringPanel({
  boardUserId,
  templates,
}: {
  boardUserId: string;
  templates: RecurringTask[];
}) {
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState("DAILY");
  const [error, action, pending] = useActionState(createRecurringTask, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !error) {
      setOpen(false);
      formRef.current?.reset();
      setFrequency("DAILY");
    }
    wasPending.current = pending;
  }, [pending, error]);

  async function handleDelete(id: string) {
    try {
      await deleteRecurringTask({ id });
    } catch {
      toast.error("Не удалось удалить регулярную задачу");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Регулярная задача</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Новая регулярная задача</DialogTitle>
            </DialogHeader>
            <form ref={formRef} action={action} className="flex flex-col gap-4">
              <input type="hidden" name="assigneeId" value={boardUserId} />
              <Input name="title" placeholder="Что нужно делать?" required />
              <Textarea
                name="description"
                placeholder="Описание задачи"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Приоритет (1–10)
                  </Label>
                  <Input
                    name="priority"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={5}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Периодичность
                  </Label>
                  <Select
                    name="frequency"
                    value={frequency}
                    onValueChange={setFrequency}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Каждый день</SelectItem>
                      <SelectItem value="WEEKLY">Каждую неделю</SelectItem>
                      <SelectItem value="MONTHLY">Каждый месяц</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {frequency === "WEEKLY" && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    День недели
                  </Label>
                  <Select name="weekday" defaultValue="1">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekdayLabels.map((label, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {frequency === "MONTHLY" && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Число месяца
                  </Label>
                  <Input
                    name="dayOfMonth"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={1}
                  />
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={pending} size="lg">
                {pending ? "Создание..." : "Создать"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Регулярных задач пока нет. Когда наступает их время, задача
          автоматически появляется в колонке «Зробити».
        </p>
      )}

      <div className="flex flex-col gap-2">
        {templates.map((task) => (
          <Card key={task.id} className="py-3">
            <CardHeader className="flex-row items-center justify-between gap-2 px-3 space-y-0">
              <CardTitle className="text-sm font-medium">
                {task.title}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(task.id)}
              >
                Удалить
              </Button>
            </CardHeader>
            <CardContent className="flex items-center gap-2 px-3 text-sm text-muted-foreground">
              <PriorityBadge priority={task.priority} />
              {describeFrequency(task)}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
