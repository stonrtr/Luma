"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTask } from "@/server/actions/tasks";
import { Input } from "@/components/ui/input";

export function AddSubtask({ projectId, parentId }: { projectId: string; parentId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [, start] = useTransition();

  function add() {
    if (!text.trim()) return;
    const value = text.trim();
    setText("");
    start(async () => {
      await createTask({ projectId, title: value, status: "TODO", priority: "NORMAL", parentId });
      router.refresh();
    });
  }

  return (
    <div className="mt-2 flex gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="Добавить подзадачу…"
        className="h-8"
      />
      <button
        onClick={add}
        className="flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
