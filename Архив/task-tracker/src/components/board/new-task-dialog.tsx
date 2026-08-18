"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
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
import { createTask } from "@/server/actions/tasks";
import { statusLabels } from "@/components/task/status-badge";
import type { TaskStatus } from "@/generated/prisma/client";

export function NewTaskDialog({
  boardUserId,
  initialStatus,
  users,
  triggerVariant = "icon",
}: {
  boardUserId: string;
  initialStatus: TaskStatus;
  users: { id: string; name: string }[];
  triggerVariant?: "icon" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [error, action, pending] = useActionState(createTask, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !error) {
      setOpen(false);
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerVariant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`Добавить задачу в «${statusLabels[initialStatus]}»`}
          >
            <Plus className="size-4" />
          </Button>
        ) : (
          <button
            type="button"
            aria-label="Новая задача"
            className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-75 [animation-duration:2s]" />
            <Plus className="relative size-5" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">Новая задача</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={action} className="flex flex-col gap-4">
          <Input
            name="title"
            placeholder="Что нужно сделать?"
            required
            className="h-11 text-base"
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Ответственный
              </Label>
              <Select name="assigneeId" defaultValue={boardUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Статус</Label>
              <Select name="status" defaultValue={initialStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Срок</Label>
              <Input name="dueDate" type="date" />
            </div>
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
          </div>

          <Textarea
            name="description"
            placeholder="Описание задачи"
            rows={3}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} size="lg">
            {pending ? "Создание..." : "Создать задачу"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
