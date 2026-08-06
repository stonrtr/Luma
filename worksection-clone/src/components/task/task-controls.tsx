"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setTaskAssignee } from "@/server/actions/tasks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TaskControls({
  taskId,
  assigneeId,
  members,
}: {
  taskId: string;
  assigneeId: string | null;
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Виконавець</p>
      <Select
        value={assigneeId ?? "none"}
        onValueChange={(v) =>
          start(async () => {
            await setTaskAssignee({ taskId, userId: v === "none" ? null : v });
            toast.success("Виконавця оновлено");
            router.refresh();
          })
        }
      >
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Без виконавця</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
