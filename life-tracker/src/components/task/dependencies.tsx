"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Link2, X, ArrowRight } from "lucide-react";
import { addDependency, removeDependency } from "@/server/actions/tasks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TASK_STATUS_LABEL, TASK_STATUS_STYLE } from "@/lib/domain";
import type { TaskStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

type DepItem = { depId: string; taskId: string; title: string; status: TaskStatus };
type Blocked = { taskId: string; title: string; status: TaskStatus };

export function Dependencies({
  taskId, dependsOn, blocks, candidates,
}: {
  taskId: string; dependsOn: DepItem[]; blocks: Blocked[]; candidates: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState("");
  const [pending, start] = useTransition();
  const tr = useT();

  function add() {
    if (!sel) return;
    start(async () => {
      const res = await addDependency({ taskId, predecessorId: sel });
      if (res?.error) toast.error(res.error);
      else { toast.success(tr("dep.added")); setSel(""); router.refresh(); }
    });
  }

  function StatusChip({ status }: { status: TaskStatus }) {
    return <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", TASK_STATUS_STYLE[status])}>{tr(`status.${status}`)}</span>;
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Link2 className="size-4" /> {tr("task.dependenciesH")}
      </h3>

      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{tr("task.deps")}</p>
      <ul className="space-y-1.5">
        {dependsOn.map((d) => (
          <li key={d.depId} className="group flex items-center gap-2 text-sm">
            <Link href={`/tasks/${d.taskId}`} className="min-w-0 flex-1 truncate hover:text-accent-foreground">{d.title}</Link>
            <StatusChip status={d.status} />
            <button onClick={() => start(async () => { await removeDependency(d.depId); router.refresh(); })}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" title={tr("dep.remove")}>
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {dependsOn.length === 0 && <li className="text-xs text-muted-foreground">{tr("task.noDeps")}</li>}
      </ul>

      {candidates.length > 0 && (
        <div className="mt-2 flex gap-2">
          <Select value={sel} onValueChange={setSel}>
            <SelectTrigger size="sm" className="h-8 flex-1"><SelectValue placeholder={tr("dep.addPredPh")} /></SelectTrigger>
            <SelectContent>
              {candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={add} disabled={pending || !sel}>{tr("common.add")}</Button>
        </div>
      )}

      {blocks.length > 0 && (
        <>
          <p className="mb-1.5 mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <ArrowRight className="size-3" /> {tr("task.blocks")}
          </p>
          <ul className="space-y-1.5">
            {blocks.map((b) => (
              <li key={b.taskId} className="flex items-center gap-2 text-sm">
                <Link href={`/tasks/${b.taskId}`} className="min-w-0 flex-1 truncate hover:text-accent-foreground">{b.title}</Link>
                <StatusChip status={b.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
