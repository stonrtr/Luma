"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment } from "@/server/actions/comments";

export function CommentForm({ taskId }: { taskId: string }) {
  const [error, action, pending] = useActionState(addComment, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !error) {
      formRef.current?.reset();
    }
  }, [pending, error]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <Textarea name="body" placeholder="Написать комментарий..." rows={3} required />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Отправка..." : "Отправить"}
      </Button>
    </form>
  );
}
