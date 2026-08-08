"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Repeat } from "lucide-react";
import { createLifeRecurring, deleteLifeRecurring } from "@/server/actions/life";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Sphere } from "./sphere-board";

export type RecurringItem = {
  id: string;
  title: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  weekdays: string | null;
  dayOfMonth: number | null;
  priority: number;
  tag: { name: string; color: string } | null;
};

const WEEKDAYS = [
  { n: 1, l: "Пн" }, { n: 2, l: "Вт" }, { n: 3, l: "Ср" }, { n: 4, l: "Чт" },
  { n: 5, l: "Пт" }, { n: 6, l: "Сб" }, { n: 7, l: "Вс" },
];
const FREQ_LABEL: Record<RecurringItem["frequency"], string> = { DAILY: "Каждый день", WEEKLY: "По дням недели", MONTHLY: "Раз в месяц" };

function describe(r: RecurringItem): string {
  if (r.frequency === "DAILY") return "каждый день";
  if (r.frequency === "MONTHLY") return `${r.dayOfMonth ?? 1}-го числа`;
  const set = new Set((r.weekdays ?? "").split(",").map((s) => s.trim()));
  return WEEKDAYS.filter((w) => set.has(String(w.n))).map((w) => w.l).join(", ") || "—";
}

export function RecurringManager({
  projectId, spheres, items, onClose,
}: {
  projectId: string;
  spheres: Sphere[];
  items: RecurringItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [sphereId, setSphereId] = useState(spheres[0]?.id ?? "");
  const [frequency, setFrequency] = useState<RecurringItem["frequency"]>("WEEKLY");
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [dayOfMonth, setDayOfMonth] = useState(1);

  function toggleDay(n: number) {
    setWeekdays((prev) => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });
  }

  function add() {
    if (!title.trim()) { toast.error("Введите название"); return; }
    if (frequency === "WEEKLY" && weekdays.size === 0) { toast.error("Выберите хотя бы один день"); return; }
    start(async () => {
      const r = await createLifeRecurring({
        projectId,
        sphereTagId: sphereId || undefined,
        title: title.trim(),
        priority: 5,
        frequency,
        weekdays: [...weekdays].sort().join(","),
        dayOfMonth,
      });
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Повтор добавлен");
      setTitle("");
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => { await deleteLifeRecurring({ id }); router.refresh(); });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Repeat className="size-4" /> Повторяющиеся задачи</DialogTitle>
        </DialogHeader>

        {items.length > 0 && (
          <div className="space-y-1.5">
            {items.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                {r.tag && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.tag.color }} />}
                <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{describe(r)}</span>
                <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => remove(r.id)} disabled={pending}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 space-y-3 rounded-lg border border-dashed p-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Зарядка" onKeyDown={(e) => e.key === "Enter" && add()} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Сфера</Label>
              <Select value={sphereId} onValueChange={setSphereId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Без сферы" /></SelectTrigger>
                <SelectContent>
                  {spheres.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Частота</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringItem["frequency"])}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((f) => (
                    <SelectItem key={f} value={f}>{FREQ_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {frequency === "WEEKLY" && (
            <div className="flex gap-1">
              {WEEKDAYS.map((w) => (
                <button
                  key={w.n}
                  type="button"
                  onClick={() => toggleDay(w.n)}
                  className={cn(
                    "flex h-8 flex-1 items-center justify-center rounded-md border text-xs font-medium transition-all",
                    weekdays.has(w.n) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {w.l}
                </button>
              ))}
            </div>
          )}

          {frequency === "MONTHLY" && (
            <div className="flex items-center gap-2">
              <Label className="shrink-0">Число месяца</Label>
              <Input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))} className="h-9 w-20" />
            </div>
          )}

          <Button className="w-full" onClick={add} disabled={pending}><Plus className="size-4" /> Добавить повтор</Button>
        </div>
        <p className="text-xs text-muted-foreground">Задачи создаются автоматически по расписанию (ежедневный прогон).</p>
      </DialogContent>
    </Dialog>
  );
}
