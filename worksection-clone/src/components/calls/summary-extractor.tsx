"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { extractTaskTitles } from "@/server/actions/calls";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NewTaskDialog } from "@/components/board/new-task-dialog";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SummaryExtractor({ viewerId }: { viewerId: string }) {
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
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } }}
        rows={8}
        placeholder="Вставте сюди повний текст саммарі созвону з керівником…"
      />
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          ШІ виокремить задачі. Кожна відкриється у стандартній картці — задасте пріоритет, плановий час і дедлайн, створите, і одразу відкриється наступна.
        </p>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={run} disabled={pending} className="shrink-0">
            <Sparkles className="size-4" /> {pending ? "Обробка…" : "Витягти задачі"}
          </Button>
          <span className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter</span>
        </div>
      </div>

      {queue && queue.length > 0 && (
        <NewTaskDialog
          key={index}
          projectId=""
          members={[]}
          status="IDEA"
          lockedAssigneeId={viewerId}
          initialTitle={queue[index]}
          initialStatus="IDEA"
          initialDueDate={todayStr()}
          headerTitle={`Задача ${index + 1} з ${queue.length}`}
          cancelLabel="Зупинити імпорт"
          extraFooter={<Button variant="outline" onClick={next}>Пропустити</Button>}
          onCreated={() => { setCreated((c) => c + 1); next(); }}
          onClose={finish}
        />
      )}
    </div>
  );
}
