"use client";
import { useT } from "@/lib/locale-context";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, X, ArrowRightLeft } from "lucide-react";
import type { TaskStatus } from "@/generated/prisma/enums";
import { bulkSetStatus } from "@/server/actions/tasks";
import { useSelection } from "./selection-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_DOT } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function BulkBar() {
  const sel = useSelection();
  const router = useRouter();
  const tr = useT();
  const [pending, start] = useTransition();
  if (!sel || sel.selected.size === 0) return null;

  const ids = [...sel.selected];

  function apply(status: TaskStatus) {
    start(async () => {
      await bulkSetStatus({ taskIds: ids, status });
      toast.success(`${tr("bulk.updated")}: ${ids.length}`);
      sel!.clear();
      router.refresh();
    });
  }

  return (
    <div className="fixed bottom-24 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border bg-card px-3 py-2 shadow-lg sm:bottom-6 sm:max-w-none sm:flex-nowrap">
      <span className="px-1 text-sm font-medium">{tr("bulk.selected")}: {ids.length}</span>
      <button
        onClick={() => apply("DONE")}
        disabled={pending}
        className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        <CheckCircle2 className="size-4" /> {tr("bulk.close")}
      </button>
      <Popover>
        <PopoverTrigger className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          <ArrowRightLeft className="size-4" /> {tr("bulk.move")}
        </PopoverTrigger>
        <PopoverContent align="center" side="top" className="w-44 p-1">
          {TASK_STATUSES.map((s) => (
            <button key={s} onClick={() => apply(s)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <span className={cn("size-2.5 rounded-full", TASK_STATUS_DOT[s])} />
              {TASK_STATUS_LABEL[s]}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <button onClick={() => sel.clear()} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" title={tr("bb.clearSel")}>
        <X className="size-4" />
      </button>
    </div>
  );
}
