"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag as TagIcon, Plus } from "lucide-react";
import { toggleTaskTag, createTag } from "@/server/actions/tags";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Tag = { id: string; name: string; color: string };

const COLORS = ["#64748b", "#ec4899", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function TagPicker({
  taskId,
  projectId,
  allTags,
  selectedIds,
}: {
  taskId: string;
  projectId: string;
  allTags: Tag[];
  selectedIds: string[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const selected = new Set(selectedIds);

  function toggle(tagId: string, on: boolean) {
    start(async () => {
      await toggleTaskTag({ taskId, tagId, on });
      router.refresh();
    });
  }

  function create() {
    if (!name.trim()) return;
    const value = name.trim();
    setName("");
    start(async () => {
      const tag = await createTag({ projectId, name: value, color });
      await toggleTaskTag({ taskId, tagId: tag.id, on: true });
      router.refresh();
    });
  }

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
        <TagIcon className="size-3" /> Теги
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Теги проекта</p>
        <div className="space-y-1">
          {allTags.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted">
              <Checkbox
                checked={selected.has(t.id)}
                onCheckedChange={(c) => toggle(t.id, !!c)}
              />
              <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="text-sm">{t.name}</span>
            </label>
          ))}
          {allTags.length === 0 && <p className="text-xs text-muted-foreground">Тегов пока нет</p>}
        </div>

        <div className="mt-3 border-t pt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Новый тег</p>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn("size-5 rounded-full", color === c && "ring-2 ring-offset-1 ring-ring")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Название"
              className="h-8"
            />
            <button
              onClick={create}
              className="flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
