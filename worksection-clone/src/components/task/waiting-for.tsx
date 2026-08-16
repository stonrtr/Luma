"use client";
import { useT } from "@/lib/locale-context";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hourglass } from "lucide-react";
import { setTaskWaiting } from "@/server/actions/tasks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Member = { id: string; name: string };

// «Моя часть готова, жду коллегу» — помечает ожидание, снимает вину за просрочку.
export function WaitingFor({ taskId, current, candidates }: { taskId: string; current: { id: string; name: string } | null; candidates: Member[] }) {
  const router = useRouter();
  const tr = useT();
  const [pending, start] = useTransition();

  function set(id: string | null) {
    start(async () => {
      const r = await setTaskWaiting({ taskId, waitingForId: id });
      if (r?.error) toast.error(r.error);
      else router.refresh();
    });
  }

  if (current) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Hourglass className="size-4 shrink-0 text-amber-600" />
        <span className="min-w-0 flex-1 truncate">{tr("task.waitingFor")}: <span className="font-medium">{current.name}</span></span>
        <button disabled={pending} onClick={() => set(null)} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">{tr("task.waitingClear")}</button>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger disabled={pending} className="flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <Hourglass className="size-4" /> {tr("task.waitingSet")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <p className="px-2 py-1 text-xs text-muted-foreground">{tr("task.waitingPick")}</p>
        <div className="max-h-64 overflow-y-auto">
          {candidates.map((m) => (
            <button key={m.id} disabled={pending} onClick={() => set(m.id)} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted">{m.name}</button>
          ))}
          {candidates.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">—</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
