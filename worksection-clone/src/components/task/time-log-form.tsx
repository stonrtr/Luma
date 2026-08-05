"use client";

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

  function submit() {
    const h = parseFloat(hours.replace(",", "."));
    if (!h || h <= 0) {
      toast.error("Введите количество часов");
      return;
    }
    start(async () => {
      try {
        await logTime({ taskId, minutes: Math.round(h * 60), note });
        setHours("");
        setNote("");
        toast.success("Время записано");
        router.refresh();
      } catch {
        toast.error("Не удалось записать время");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-24">
        <Input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Часы"
          inputMode="decimal"
          className="h-8"
        />
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Комментарий (необязательно)"
        className="h-8 flex-1"
      />
      <Button size="sm" variant="outline" onClick={submit} disabled={pending}>
        {pending ? "…" : "Записать"}
      </Button>
    </div>
  );
}
