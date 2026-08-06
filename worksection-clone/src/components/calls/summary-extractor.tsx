"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { extractTasksFromSummary } from "@/server/actions/calls";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function SummaryExtractor() {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [pending, start] = useTransition();

  function run() {
    if (summary.trim().length < 10) { toast.error("Вставте текст саммарі дзвінка"); return; }
    start(async () => {
      const res = await extractTasksFromSummary({ summary });
      if (res?.error) { toast.error(res.error); return; }
      toast.success(`Додано задач у «Ідеї»: ${res.created}`);
      setSummary("");
      router.refresh();
    });
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
          ШІ виокремить чіткі задачі й додасть їх у «Ідеї» по одній. Пріоритет і дедлайн проставите самостійно.
        </p>
        <Button onClick={run} disabled={pending} className="shrink-0">
          <Sparkles className="size-4" /> {pending ? "Обробка…" : "Витягти задачі"}
        </Button>
      </div>
    </div>
  );
}
