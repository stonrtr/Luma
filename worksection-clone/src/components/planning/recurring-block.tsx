"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createRecurringTask, deleteRecurringTask } from "@/server/actions/recurring";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_VALUES, DEFAULT_PRIORITY, priorityStyle } from "@/lib/domain";
import { cn } from "@/lib/utils";

type Recurring = {
  id: string; title: string; priority: number; frequency: string; weekdays: string | null; dayOfMonth: number | null;
};
const WD = [["1", "Пн"], ["2", "Вт"], ["3", "Ср"], ["4", "Чт"], ["5", "Пт"], ["6", "Сб"], ["7", "Нд"]];
const FREQ_LABEL: Record<string, string> = { DAILY: "щодня", WEEKLY: "щотижня", MONTHLY: "щомісяця" };

export function RecurringBlock({ userId, items, canEdit }: { userId: string; items: Recurring[]; canEdit: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [frequency, setFrequency] = useState("WEEKLY");
  const [days, setDays] = useState<Set<string>>(new Set(["1", "2", "3", "4", "5"]));
  const [, start] = useTransition();

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
      });
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }

  function describe(r: Recurring) {
    if (r.frequency === "WEEKLY" && r.weekdays) {
      const names = r.weekdays.split(",").map((d) => WD.find((w) => w[0] === d.trim())?.[1]).filter(Boolean).join(", ");
      return `щотижня · ${names}`;
    }
    if (r.frequency === "MONTHLY") return `щомісяця · ${r.dayOfMonth} число`;
    return FREQ_LABEL[r.frequency] ?? r.frequency;
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Repeat className="size-4 text-primary" /> Регулярні задачі
      </h3>
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li key={r.id} className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <span className={cn("flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold", priorityStyle(r.priority))}>{r.priority}</span>
            <span className="flex-1 text-sm">{r.title}</span>
            <span className="text-xs text-muted-foreground">{describe(r)}</span>
            {canEdit && (
              <button onClick={() => start(async () => { await deleteRecurringTask(r.id); router.refresh(); })} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100">
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted-foreground">Регулярних задач немає.</li>}
      </ul>

      {canEdit && (
        <div className="mt-3 space-y-2 rounded-lg border border-dashed p-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Напр. Щоденний стендап…" className="h-8" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5">
              {PRIORITY_VALUES.map((p) => (
                <button key={p} type="button" onClick={() => setPriority(p)} className={cn("flex size-6 items-center justify-center rounded text-[11px] font-medium", priority === p ? cn(priorityStyle(p), "ring-1 ring-ring ring-offset-1") : "border text-muted-foreground hover:bg-muted")}>{p}</button>
              ))}
            </div>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Щодня</SelectItem>
                <SelectItem value="WEEKLY">Щотижня</SelectItem>
                <SelectItem value="MONTHLY">Щомісяця</SelectItem>
              </SelectContent>
            </Select>
            <button onClick={add} className="flex size-8 items-center justify-center rounded-md border hover:bg-muted"><Plus className="size-4" /></button>
          </div>
          {frequency === "WEEKLY" && (
            <div className="flex gap-1">
              {WD.map(([d, label]) => (
                <button key={d} type="button" onClick={() => toggleDay(d)} className={cn("flex size-7 items-center justify-center rounded text-[11px] font-medium", days.has(d) ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-muted")}>{label}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
