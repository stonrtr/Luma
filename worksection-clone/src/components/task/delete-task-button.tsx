"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTask } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";

// Удаление задачи с подтверждением; после — возврат на доску (проекта или личную)
export function DeleteTaskButton({ taskId, fallback }: { taskId: string; fallback: string }) {
  const router = useRouter();
  const tr = useT();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (confirming) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{tr("task.deleteConfirm")}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await deleteTask(taskId);
              if (r?.error) { toast.error(r.error); return; }
              toast.success(tr("common.delete") + " ✓");
              router.push(r?.projectId ? `/projects/${r.projectId}` : fallback);
              router.refresh();
            })}
          >
            <Trash2 className="size-4" /> {tr("common.delete")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
            {tr("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
    >
      <Trash2 className="size-4" /> {tr("task.delete")}
    </button>
  );
}
