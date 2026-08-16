"use client";

import { useMemo } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { BoardTask } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/lib/i18n";

export type BoardFilter = { assignee: string; tag: string; minPriority: number; fromSummary: boolean; byManager: boolean };
export const DEFAULT_FILTER: BoardFilter = { assignee: "", tag: "", minPriority: 1, fromSummary: false, byManager: false };

export function applyFilter(t: BoardTask, f: BoardFilter): boolean {
  if (f.assignee && !t.assignees.some((a) => a.id === f.assignee)) return false;
  if (f.tag && !t.tags.some((tag) => tag.id === f.tag)) return false;
  if (f.fromSummary && !t.fromSummary) return false;
  if (f.byManager && !t.assignedByManager) return false;
  if (t.priority < f.minPriority) return false;
  return true;
}

const ALL = "__all__";

export function BoardFilterBar({ tasks, filter, onChange, locale = "uk" }: { tasks: BoardTask[]; filter: BoardFilter; onChange: (f: BoardFilter) => void; locale?: string }) {
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

  const active = !!filter.assignee || !!filter.tag || filter.minPriority > 1 || filter.fromSummary || filter.byManager;
  const anyFromSummary = useMemo(() => tasks.some((t) => t.fromSummary), [tasks]);
  const anyByManager = useMemo(() => tasks.some((t) => t.assignedByManager), [tasks]);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <SlidersHorizontal className="size-3.5" /> {t(locale, "filters.label")}
      </span>

      {assignees.length > 1 && (
        <Select value={filter.assignee || ALL} onValueChange={(v) => onChange({ ...filter, assignee: v === ALL ? "" : v })}>
          <SelectTrigger size="sm" className="h-8 w-auto min-w-36"><SelectValue placeholder={t(locale, "filters.assignee")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t(locale, "filters.allAssignees")}</SelectItem>
            {assignees.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {tags.length > 0 && (
        <Select value={filter.tag || ALL} onValueChange={(v) => onChange({ ...filter, tag: v === ALL ? "" : v })}>
          <SelectTrigger size="sm" className="h-8 w-auto min-w-32"><SelectValue placeholder={t(locale, "filters.tag")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t(locale, "filters.allTags")}</SelectItem>
            {tags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={String(filter.minPriority)} onValueChange={(v) => onChange({ ...filter, minPriority: Number(v) })}>
        <SelectTrigger size="sm" className="h-8 w-auto min-w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="1">{t(locale, "filters.anyPriority")}</SelectItem>
          {[3, 5, 7, 9].map((p) => <SelectItem key={p} value={String(p)}>{t(locale, "filters.priorityGte")} {p}</SelectItem>)}
        </SelectContent>
      </Select>

      {anyFromSummary && (
        <button
          onClick={() => onChange({ ...filter, fromSummary: !filter.fromSummary })}
          className={
            "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
            (filter.fromSummary
              ? "border-[#c9bbec] bg-[#EDE7FA] text-[#5B47A6] dark:border-[#3a2e5c] dark:bg-[#241d3a] dark:text-[#c3b6f0]"
              : "text-muted-foreground hover:bg-muted")
          }
          title={t(locale, "filters.fromSummary")}
        >
          {t(locale, "filters.fromSummary")}
        </button>
      )}

      {anyByManager && (
        <button
          onClick={() => onChange({ ...filter, byManager: !filter.byManager })}
          className={
            "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
            (filter.byManager
              ? "border-[#E8B892] bg-[#FBE6D6] text-[#A0561F] dark:border-[#5a3a1e] dark:bg-[#33210f] dark:text-[#e2b382]"
              : "text-muted-foreground hover:bg-muted")
          }
          title={t(locale, "filters.byManager")}
        >
          {t(locale, "filters.byManager")}
        </button>
      )}

      {active && (
        <button onClick={() => onChange(DEFAULT_FILTER)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          <X className="size-3" /> {t(locale, "filters.reset")}
        </button>
      )}
    </div>
  );
}
