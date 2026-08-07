"use client";

import { useMemo } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { BoardTask } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type BoardFilter = { assignee: string; tag: string; minPriority: number };
export const DEFAULT_FILTER: BoardFilter = { assignee: "", tag: "", minPriority: 1 };

export function applyFilter(t: BoardTask, f: BoardFilter): boolean {
  if (f.assignee && !t.assignees.some((a) => a.id === f.assignee)) return false;
  if (f.tag && !t.tags.some((tag) => tag.id === f.tag)) return false;
  if (t.priority < f.minPriority) return false;
  return true;
}

const ALL = "__all__";

export function BoardFilterBar({ tasks, filter, onChange }: { tasks: BoardTask[]; filter: BoardFilter; onChange: (f: BoardFilter) => void }) {
  const assignees = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) for (const a of t.assignees) m.set(a.id, a.name);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const tags = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) for (const tag of t.tags) m.set(tag.id, tag.name);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const active = !!filter.assignee || !!filter.tag || filter.minPriority > 1;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <SlidersHorizontal className="size-3.5" /> Фільтри
      </span>

      {assignees.length > 1 && (
        <Select value={filter.assignee || ALL} onValueChange={(v) => onChange({ ...filter, assignee: v === ALL ? "" : v })}>
          <SelectTrigger size="sm" className="h-8 w-auto min-w-36"><SelectValue placeholder="Виконавець" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Усі виконавці</SelectItem>
            {assignees.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {tags.length > 0 && (
        <Select value={filter.tag || ALL} onValueChange={(v) => onChange({ ...filter, tag: v === ALL ? "" : v })}>
          <SelectTrigger size="sm" className="h-8 w-auto min-w-32"><SelectValue placeholder="Мітка" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Усі мітки</SelectItem>
            {tags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={String(filter.minPriority)} onValueChange={(v) => onChange({ ...filter, minPriority: Number(v) })}>
        <SelectTrigger size="sm" className="h-8 w-auto min-w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Будь-який пріоритет</SelectItem>
          {[3, 5, 7, 9].map((p) => <SelectItem key={p} value={String(p)}>Пріоритет ≥ {p}</SelectItem>)}
        </SelectContent>
      </Select>

      {active && (
        <button onClick={() => onChange(DEFAULT_FILTER)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          <X className="size-3" /> Скинути
        </button>
      )}
    </div>
  );
}
