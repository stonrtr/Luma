"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TaskStatus } from "@/generated/prisma/enums";
import { updateTask, setTaskAssignee } from "@/server/actions/tasks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  PRIORITY_VALUES,
} from "@/lib/domain";

export function TaskControls({
  taskId,
  status,
  priority,
  assigneeId,
  members,
}: {
  taskId: string;
  status: TaskStatus;
  priority: number;
  assigneeId: string | null;
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  function run(fn: () => Promise<void>, ok: string) {
    start(async () => {
      try {
        await fn();
        toast.success(ok);
        router.refresh();
      } catch {
        toast.error("Не удалось сохранить");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Field label="Статус">
        <Select
          value={status}
          onValueChange={(v) => run(() => updateTask({ taskId, status: v as TaskStatus }), "Статус обновлён")}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Пріоритет">
        <Select
          value={String(priority)}
          onValueChange={(v) => run(() => updateTask({ taskId, priority: Number(v) }), "Пріоритет оновлено")}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRIORITY_VALUES.map((p) => (
              <SelectItem key={p} value={String(p)}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Виконавець">
        <Select
          value={assigneeId ?? "none"}
          onValueChange={(v) =>
            run(() => setTaskAssignee({ taskId, userId: v === "none" ? null : v }), "Исполнитель обновлён")
          }
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Без исполнителя</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
