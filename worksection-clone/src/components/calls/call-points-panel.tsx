"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check } from "lucide-react";
import { addCallPoint, toggleCallPoint, deleteCallPoint } from "@/server/actions/calls";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type Point = { id: string; text: string; done: boolean };
type Member = { id: string; name: string; title: string | null; points: Point[] };

export function CallPointsPanel({ members }: { members: Member[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {members.map((m) => <MemberCard key={m.id} member={m} />)}
      {members.length === 0 && <p className="text-sm text-muted-foreground">Немає інших учасників команди.</p>}
    </div>
  );
}

function MemberCard({ member }: { member: Member }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [, start] = useTransition();

  function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    start(async () => { await addCallPoint({ memberId: member.id, text: t }); router.refresh(); });
  }

  const openCount = member.points.filter((p) => !p.done).length;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Avatar className="size-8"><AvatarFallback className="text-[10px]">{initials(member.name)}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{member.name}</p>
          <p className="truncate text-xs text-muted-foreground leading-tight">{member.title ?? "—"}</p>
        </div>
        {openCount > 0 && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{openCount}</span>}
      </div>

      <ul className="mb-2 space-y-1">
        {member.points.map((p) => (
          <li key={p.id} className="group flex items-center gap-2 text-sm">
            <button
              onClick={() => start(async () => { await toggleCallPoint(p.id); router.refresh(); })}
              className={cn("flex size-4 shrink-0 items-center justify-center rounded border transition-colors", p.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary")}
              title={p.done ? "Знято" : "Відмітити"}
            >
              {p.done && <Check className="size-3" />}
            </button>
            <span className={cn("flex-1", p.done && "text-muted-foreground line-through")}>{p.text}</span>
            <button onClick={() => start(async () => { await deleteCallPoint(p.id); router.refresh(); })} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100">
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {member.points.length === 0 && <li className="text-xs text-muted-foreground">Поки без поінтів.</li>}
      </ul>

      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Що обговорити…" className="h-8" />
        <button onClick={add} className="flex size-8 shrink-0 items-center justify-center rounded-md border hover:bg-muted"><Plus className="size-4" /></button>
      </div>
    </div>
  );
}
