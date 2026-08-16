"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addGoal, deleteGoal } from "@/server/actions/planning";
import { Input } from "@/components/ui/input";

type Goal = { id: string; text: string };

export function GoalsBlock({
  userId, year, month, goals, canManage,
}: {
  userId: string; year: number; month: number; goals: Goal[]; canManage: boolean;
}) {
  const router = useRouter();
  const tr = useT();
  const [text, setText] = useState("");
  const [, start] = useTransition();

  function add() {
    if (!text.trim()) return;
    const value = text.trim();
    setText("");
    start(async () => {
      const res = await addGoal({ userId, text: value, year, month });
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Target className="size-4 text-accent-foreground" /> {tr("goal.title")}
      </h3>
      <ul className="space-y-1.5">
        {goals.map((g) => (
          <li key={g.id} className="group flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="flex-1">{g.text}</span>
            {canManage && (
              <button
                onClick={() => start(async () => { await deleteGoal(g.id); router.refresh(); })}
                className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {goals.length === 0 && <li className="text-sm text-muted-foreground">{tr("goal.empty")}</li>}
      </ul>
      {canManage && (
        <div className="mt-2 flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={tr("goal.ph")} className="h-8" />
          <button onClick={add} className="flex size-8 shrink-0 items-center justify-center rounded-md border hover:bg-muted"><Plus className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
