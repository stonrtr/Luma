"use client";

import { useActionState } from "react";
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
import { updateTask } from "@/server/actions/tasks";
import { statusLabels } from "@/components/task/status-badge";
import type { Task } from "@/generated/prisma/client";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function TaskDetailForm({
  task,
  users,
}: {
  task: Task;
  users: { id: string; name: string }[];
}) {
  const [error, action, pending] = useActionState(updateTask, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="taskId" value={task.id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Название</Label>
        <Input id="title" name="title" defaultValue={task.title} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={task.description ?? ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Статус</Label>
          <Select name="status" defaultValue={task.status}>
            <SelectTrigger id="status">
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="priority">Приоритет (1–10)</Label>
          <Input
            id="priority"
            name="priority"
            type="number"
            min={1}
            max={10}
            defaultValue={task.priority}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dueDate">Срок</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={toDateInputValue(task.dueDate)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="assigneeId">Ответственный</Label>
          <Select name="assigneeId" defaultValue={task.assigneeId}>
            <SelectTrigger id="assigneeId">
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
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Сохранение..." : "Сохранить"}
      </Button>
    </form>
  );
}
