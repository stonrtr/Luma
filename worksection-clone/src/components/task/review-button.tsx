"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { sendForReview } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";

export function ReviewButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" className="w-full" disabled={pending}
      onClick={() => start(async () => { await sendForReview(taskId); toast.success("Відправлено на перевірку"); router.refresh(); })}>
      <Send className="size-4" /> На перевірку керівнику
    </Button>
  );
}
