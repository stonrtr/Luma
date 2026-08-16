"use client";
import { useT } from "@/lib/locale-context";

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
  const tr = useT();
  const [, start] = useTransition();

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{tr("tc2.assignee")}</p>
      <Select
        value={assigneeId ?? undefined}
        onValueChange={(v) =>
          start(async () => {
            await setTaskAssignee({ taskId, userId: v });
            toast.success(tr("tc2.assigneeUpdated"));
            router.refresh();
          })
        }
      >
        <SelectTrigger className="w-full"><SelectValue placeholder={tr("tc2.selectAssignee")} /></SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
