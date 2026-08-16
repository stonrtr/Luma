"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logTime } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TimeLogForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const tr = useT();

  function submit() {
    const h = parseFloat(hours.replace(",", "."));
    if (!h || h <= 0) {
      toast.error(tr("tl.enterHours"));
      return;
    }
    start(async () => {
      try {
        await logTime({ taskId, minutes: Math.round(h * 60), note });
        setHours("");
        setNote("");
        toast.success(tr("tl.timeLogged"));
        router.refresh();
      } catch {
        toast.error(tr("tl.logFailed"));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-24">
        <Input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder={tr("task.hoursPh")}
          inputMode="decimal"
          className="h-8"
        />
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={tr("task.notePh")}
        className="h-8 flex-1"
      />
      <Button size="sm" variant="outline" onClick={submit} disabled={pending}>
        {pending ? "…" : tr("tl.log")}
      </Button>
    </div>
  );
}
