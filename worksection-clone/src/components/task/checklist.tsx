"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
} from "@/server/actions/tasks";

type Item = { id: string; text: string; done: boolean };

export function Checklist({ taskId, items }: { taskId: string; items: Item[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [, start] = useTransition();

  const done = items.filter((i) => i.done).length;

  function add() {
    if (!text.trim()) return;
    const value = text.trim();
    setText("");
    start(async () => {
      await addChecklistItem({ taskId, text: value });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Чек-лист</h3>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">{done}/{items.length}</span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
          />
        </div>
      )}

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/50">
            <Checkbox
              checked={item.done}
              onCheckedChange={(c) =>
                start(async () => {
                  await toggleChecklistItem({ id: item.id, done: !!c, taskId });
                  router.refresh();
                })
              }
            />
            <span className={item.done ? "flex-1 text-sm text-muted-foreground line-through" : "flex-1 text-sm"}>
              {item.text}
            </span>
            <button
              onClick={() =>
                start(async () => {
                  await deleteChecklistItem({ id: item.id, taskId });
                  router.refresh();
                })
              }
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Добавить пункт…"
          className="h-8"
        />
        <button
          onClick={add}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
