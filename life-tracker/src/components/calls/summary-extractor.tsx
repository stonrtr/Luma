"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { importSummary } from "@/server/actions/calls";
import type { SummaryPrefill } from "@/lib/summary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NewTaskDialog } from "@/components/board/new-task-dialog";
import { SummaryCompleteQueue } from "@/components/workspace/summary-complete-queue";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SummaryExtractor({ viewerId, onDone }: { viewerId: string; onDone?: () => void }) {
  const router = useRouter();
  const tr = useT();
  const [summary, setSummary] = useState("");
  const [pending, start] = useTransition();
  // Довільний текст → черга титулів (ІІ + майстер). Розмічений → черга неповних задач.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [pendingTasks, setPendingTasks] = useState<SummaryPrefill[] | null>(null);
  const [index, setIndex] = useState(0);
  const [created, setCreated] = useState(0);

  function run() {
    if (summary.trim().length < 10) { toast.error(tr("se.pasteText")); return; }
    start(async () => {
      const res = await importSummary({ summary });
      if (!res.kind) { toast.error(res.error); return; }
      if (res.kind === "structured") {
        if (res.created > 0) toast.success(`${tr("se.createdNow")}: ${res.created}`);
        if (res.pending.length === 0) {
          // все повне — нічого питати
          setSummary("");
          router.refresh();
          onDone?.();
          return;
        }
        // по неповних задачах спитаємо лише відсутні параметри
        setPendingTasks(res.pending);
        return;
      }
      setQueue(res.titles);
      setIndex(0);
      setCreated(0);
    });
  }

  function finish() {
    setQueue(null);
    setSummary("");
    router.refresh();
    if (created > 0) toast.success(`${tr("se.addedToIdeas")}: ${created}`);
    onDone?.();
  }

  function finishStructured() {
    setPendingTasks(null);
    setSummary("");
    router.refresh();
    onDone?.();
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
        placeholder={tr("se.pastePh")}
      />
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground">{tr("se.hint")}</p>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={run} disabled={pending} className="shrink-0">
            <Sparkles className="size-4" /> {pending ? tr("se.processing") : tr("se.extract")}
          </Button>
          <span className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter</span>
        </div>
      </div>

      {/* Розмічений шаблон: неповні задачі — питаємо лише відсутнє */}
      {pendingTasks && pendingTasks.length > 0 && (
        <SummaryCompleteQueue tasks={pendingTasks} onFinish={finishStructured} />
      )}

      {/* Довільний текст: майстер по кожному титулу */}
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
          cancelLabel={tr("se.stopImport")}
          extraFooter={<Button variant="outline" onClick={next}>{tr("se.skip")}</Button>}
          onCreated={() => { setCreated((c) => c + 1); next(); }}
          onClose={finish}
        />
      )}
    </div>
  );
}
