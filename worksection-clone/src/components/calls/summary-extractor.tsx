"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { extractTaskTitles } from "@/server/actions/calls";
import { createTask } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PRIORITY_VALUES, DEFAULT_PRIORITY, priorityStyle } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function SummaryExtractor() {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [pending, start] = useTransition();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [created, setCreated] = useState(0);

  function run() {
    if (summary.trim().length < 10) { toast.error("Вставте текст саммарі дзвінка"); return; }
    start(async () => {
      const res = await extractTaskTitles({ summary });
      if (res.error) { toast.error(res.error); return; }
      setQueue(res.titles);
      setIndex(0);
      setCreated(0);
    });
  }

  function finish() {
    setQueue(null);
    setSummary("");
    router.refresh();
    if (created > 0) toast.success(`Додано задач у «Ідеї»: ${created}`);
  }

  function next() {
    if (!queue) return;
    if (index + 1 >= queue.length) finish();
    else setIndex(index + 1);
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={8}
        placeholder="Вставте сюди повний текст саммарі созвону з керівником…"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          ШІ виокремить задачі. Для кожної задасте пріоритет і дедлайн та створите — далі одразу відкриється наступна.
        </p>
        <Button onClick={run} disabled={pending} className="shrink-0">
          <Sparkles className="size-4" /> {pending ? "Обробка…" : "Витягти задачі"}
        </Button>
      </div>

      {queue && (
        <ImportWizard
          title={queue[index]}
          index={index}
          total={queue.length}
          onCreated={() => { setCreated((c) => c + 1); next(); }}
          onSkip={next}
          onStop={finish}
        />
      )}
    </div>
  );
}

function ImportWizard({
  title: initialTitle, index, total, onCreated, onSkip, onStop,
}: {
  title: string; index: number; total: number;
  onCreated: () => void; onSkip: () => void; onStop: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [pending, start] = useTransition();

  // при переходе к следующей задаче сбрасываем поля
  const stepKey = `${index}-${initialTitle}`;
  const [key, setKey] = useState(stepKey);
  if (key !== stepKey) {
    setKey(stepKey);
    setTitle(initialTitle);
    setPriority(DEFAULT_PRIORITY);
    setDueDate("");
    setDueTime("");
  }

  function create() {
    if (!title.trim()) return;
    start(async () => {
      await createTask({
        title: title.trim(),
        status: "IDEA",
        priority,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
      });
      onCreated();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onStop()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Задача {index + 1} з {total}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wiz-title">Назва</Label>
            <Input id="wiz-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label>Пріоритет</Label>
            <div className="flex gap-1">
              {PRIORITY_VALUES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex h-8 flex-1 items-center justify-center rounded-md border text-sm font-medium transition-all",
                    priority === p ? cn(priorityStyle(p), "border-transparent ring-2 ring-offset-1 ring-ring") : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="wiz-date">Дедлайн</Label>
              <Input id="wiz-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wiz-time">Час</Label>
              <Input id="wiz-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onStop} disabled={pending}>Зупинити імпорт</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onSkip} disabled={pending}>Пропустити</Button>
            <Button onClick={create} disabled={pending}>{pending ? "Створення…" : "Створити"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
