"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, X } from "lucide-react";
import { addComment } from "@/server/actions/comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string };

export function CommentForm({ taskId, members }: { taskId: string; members: Member[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const tr = useT();

  function toggleMention(id: string) {
    setMentions((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    if (!body.trim()) return;
    const value = body.trim();
    const m = mentions;
    start(async () => {
      try {
        await addComment({ taskId, body: value, mentions: m });
        setBody(""); setMentions([]);
        router.refresh();
      } catch {
        toast.error(tr("cf.sendFailed"));
      }
    });
  }

  const mentioned = members.filter((m) => mentions.includes(m.id));

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={tr("task.commentPh")}
        rows={3}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
      />
      {mentioned.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mentioned.map((m) => (
            <span key={m.id} className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              @{m.name}
              <button onClick={() => toggleMention(m.id)} className="hover:text-destructive"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {members.length > 0 && (
            <Popover>
              <PopoverTrigger className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
                <AtSign className="size-3.5" /> {tr("cf.mention")}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1">
                {members.map((m) => (
                  <button key={m.id} onClick={() => toggleMention(m.id)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted", mentions.includes(m.id) && "bg-muted")}>
                    <Avatar className="size-6"><AvatarFallback className="text-[9px]">{initials(m.name)}</AvatarFallback></Avatar>
                    {m.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          <span className="hidden text-xs text-muted-foreground sm:inline">⌘/Ctrl + Enter</span>
        </div>
        <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
          {pending ? tr("cf.sending") : tr("cf.send")}
        </Button>
      </div>
    </div>
  );
}
