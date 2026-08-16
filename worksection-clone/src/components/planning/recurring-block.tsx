"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createRecurringTask, deleteRecurringTask } from "@/server/actions/recurring";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_VALUES, DEFAULT_PRIORITY, priorityStyle, priorityTone } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type Recurring = {
  id: string; title: string; priority: number; frequency: string; weekdays: string | null; dayOfMonth: number | null;
  startTime?: string | null; // "HH:MM" — час старту екземплярів
  dueDayOfMonth?: number | null; // щомісячні: число-дедлайн
};
const WD = ["1", "2", "3", "4", "5", "6", "7"];


export function RecurringBlock({ userId, items, canEdit, showForm = false, teamItems }: {
  userId: string; items: Recurring[]; canEdit: boolean; showForm?: boolean;
  teamItems?: (Recurring & { assigneeName: string })[]; // регулярки подчинённых (для руководителя)
}) {
  const router = useRouter();
  const tr = useT();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [frequency, setFrequency] = useState("WEEKLY");
  const [days, setDays] = useState<Set<string>>(new Set(["1", "2", "3", "4", "5"]));
  const [startTime, setStartTime] = useState("");
  const [, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null); // какой шаблон ждёт подтверждения удаления

  function toggleDay(d: string) {
    const n = new Set(days); n.has(d) ? n.delete(d) : n.add(d); setDays(n);
  }
  function add() {
    if (!title.trim()) return;
    const t = title.trim();
    setTitle("");
    start(async () => {
      const res = await createRecurringTask({
        assigneeId: userId, title: t, priority, frequency: frequency as "DAILY" | "WEEKLY" | "MONTHLY",
        weekdays: [...days].join(","),
        startTime: startTime || undefined,
      });
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }

  function describe(r: Recurring) {
    const at = r.startTime ? ` · ${r.startTime}` : "";
    if (r.frequency === "WEEKLY" && r.weekdays) {
      const names = r.weekdays.split(",").map((d) => WD.includes(d.trim()) ? tr(`wd.${d.trim()}`) : null).filter(Boolean).join(", ");
      return `${tr("freq.WEEKLY")} · ${names}${at}`;
    }
    if (r.frequency === "MONTHLY") {
      const due = r.dueDayOfMonth && r.dueDayOfMonth !== r.dayOfMonth ? ` · ${tr("dlg.deadline").toLowerCase()} ${r.dueDayOfMonth} ${tr("rec.dayNo")}` : "";
      return `${tr("freq.MONTHLY")} · ${r.dayOfMonth} ${tr("rec.dayNo")}${due}${at}`;
    }
    return `${tr(`freq.${r.frequency}`) ?? r.frequency}${at}`;
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Repeat className="size-4 text-accent-foreground" /> {tr("rec.title")}
      </h3>
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li key={r.id} className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <span className="flex size-[19px] shrink-0 items-center justify-center rounded-full border-[1.25px] bg-transparent text-[10px] font-semibold" style={{ color: priorityTone(r.priority), borderColor: priorityTone(r.priority) }}>{r.priority}</span>
            <span className="flex-1 text-sm">{r.title}</span>
            <span className="text-xs text-muted-foreground">{describe(r)}</span>
            {canEdit && (confirmId === r.id ? (
              <span className="flex shrink-0 items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{tr("rec.confirmDel")}</span>
                <button
                  onClick={() => { setConfirmId(null); start(async () => { await deleteRecurringTask(r.id); router.refresh(); }); }}
                  className="rounded-md border border-destructive/40 px-2 py-0.5 font-medium text-destructive hover:bg-destructive/10"
                >
                  {tr("common.delete")}
                </button>
                <button onClick={() => setConfirmId(null)} className="rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted" title={tr("common.cancel")}>
                  <X className="size-3.5" />
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmId(r.id)} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100">
                <X className="size-3.5" />
              </button>
            ))}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted-foreground">{tr("rec.empty")}</li>}
      </ul>

      {/* Регулярки команды — только у руководителя; удаление тем же крестиком */}
      {teamItems && teamItems.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Repeat className="size-4 text-accent-foreground" /> {tr("rec.teamTitle")}
          </h3>
          <ul className="space-y-1.5">
            {teamItems.map((r) => (
              <li key={r.id} className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <span className="flex size-[19px] shrink-0 items-center justify-center rounded-full border-[1.25px] bg-transparent text-[10px] font-semibold" style={{ color: priorityTone(r.priority), borderColor: priorityTone(r.priority) }}>{r.priority}</span>
                <span className="flex-1 text-sm">{r.title}</span>
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{r.assigneeName}</span>
                <span className="text-xs text-muted-foreground">{describe(r)}</span>
{confirmId === r.id ? (
              <span className="flex shrink-0 items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{tr("rec.confirmDel")}</span>
                <button
                  onClick={() => { setConfirmId(null); start(async () => { await deleteRecurringTask(r.id); router.refresh(); }); }}
                  className="rounded-md border border-destructive/40 px-2 py-0.5 font-medium text-destructive hover:bg-destructive/10"
                >
                  {tr("common.delete")}
                </button>
                <button onClick={() => setConfirmId(null)} className="rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted" title={tr("common.cancel")}>
                  <X className="size-3.5" />
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmId(r.id)} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100">
                <X className="size-3.5" />
              </button>
            )}
              </li>
            ))}
          </ul>
        </>
      )}

      {canEdit && showForm && (
        <div className="mt-3 space-y-2 rounded-lg border border-dashed p-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={tr("rec.titlePh")} className="h-8" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5">
              {PRIORITY_VALUES.map((p) => (
                <button key={p} type="button" onClick={() => setPriority(p)} className={cn("flex size-6 items-center justify-center rounded text-[11px] font-medium", priority === p ? cn(priorityStyle(p), "ring-1 ring-ring ring-offset-1") : "border text-muted-foreground hover:bg-muted")}>{p}</button>
              ))}
            </div>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">{tr("freq.DAILY")}</SelectItem>
                <SelectItem value="WEEKLY">{tr("freq.WEEKLY")}</SelectItem>
                <SelectItem value="MONTHLY">{tr("freq.MONTHLY")}</SelectItem>
              </SelectContent>
            </Select>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-8 w-28" title={tr("dlg.startAt")} />
            <button onClick={add} className="flex size-8 items-center justify-center rounded-md border hover:bg-muted"><Plus className="size-4" /></button>
          </div>
          {frequency === "WEEKLY" && (
            <div className="flex gap-1">
              {WD.map((d) => (
                <button key={d} type="button" onClick={() => toggleDay(d)} className={cn("flex size-7 items-center justify-center rounded text-[11px] font-medium", days.has(d) ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-muted")}>{tr(`wd.${d}`)}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
