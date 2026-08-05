"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addComment } from "@/server/actions/comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommentForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!body.trim()) return;
    const value = body.trim();
    start(async () => {
      try {
        await addComment({ taskId, body: value });
        setBody("");
        router.refresh();
      } catch {
        toast.error("Не удалось отправить комментарий");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Написать комментарий…"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter — отправить</span>
        <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
          {pending ? "Отправка…" : "Отправить"}
        </Button>
      </div>
    </div>
  );
}
