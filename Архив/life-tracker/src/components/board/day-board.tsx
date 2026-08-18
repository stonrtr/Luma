"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import type { BoardTask } from "./types";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { SelectionContext, useSelectionState } from "./selection-context";
import { BulkBar } from "./bulk-bar";
import { updateTask } from "@/server/actions/tasks";
import { mondayOf, addDays } from "@/lib/week";
import { t } from "@/lib/i18n";

// Бакеты по срокам. «Інше» (без дедлайна) — останнім. label — ключ i18n «day.*».
const BUCKETS = [
  { key: "overdue", label: "day.overdue", dot: "bg-red-500" },
  { key: "today", label: "day.today", dot: "bg-[#5AA9C9]" },
  { key: "tomorrow", label: "day.tomorrow", dot: "bg-[#8E7BD6]" },
  { key: "week", label: "day.week", dot: "bg-[#3D6B26] dark:bg-[#A9D97F]" },
  { key: "nextweek", label: "day.nextweek", dot: "bg-[#D8B25E]" },
  { key: "other", label: "day.other", dot: "bg-slate-400" },
] as const;
type BucketKey = (typeof BUCKETS)[number]["key"];
const KEYS = BUCKETS.map((b) => b.key) as BucketKey[];
type Columns = Record<BucketKey, BoardTask[]>;

function dayStart(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function bucketOf(t: BoardTask): BucketKey {
  if (!t.dueDate) return "other";
  const today = dayStart(new Date());
  const d = dayStart(new Date(t.dueDate));
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(mondayOf(today), 7);      // начало следующей недели
  const nextWeekEnd = addDays(mondayOf(today), 14); // начало недели через одну
  if (t.status !== "DONE" && d < today) return "overdue";
  if (d.getTime() === today.getTime()) return "today";
  if (d.getTime() === tomorrow.getTime()) return "tomorrow";
  if (d > tomorrow && d < weekEnd) return "week";
  if (d >= weekEnd && d < nextWeekEnd) return "nextweek"; // наступний тиждень
  return "other"; // всё, что дальше следующей недели
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Дата, которую ставим при переносе в бакет. null — убрать срок. undefined — не менять.
function dueForBucket(key: BucketKey): string | null | undefined {
  const today = dayStart(new Date());
  switch (key) {
    case "other": return null;
    case "overdue": return undefined; // нельзя осмысленно «просрочить» перетягиванием
    case "today": return iso(today);
    case "tomorrow": return iso(addDays(today, 1));
    case "week": return iso(addDays(mondayOf(today), 6));      // воскресенье текущей недели
    case "nextweek": return iso(addDays(mondayOf(today), 13)); // воскресенье следующей недели
  }
}

function group(tasks: BoardTask[]): Columns {
  const cols = Object.fromEntries(KEYS.map((k) => [k, [] as BoardTask[]])) as Columns;
  for (const t of tasks) cols[bucketOf(t)].push(t);
  for (const k of KEYS) cols[k].sort((a, b) => b.priority - a.priority || a.position - b.position);
  return cols;
}

export function DayBoard({ initialTasks, locale = "uk" }: { initialTasks: BoardTask[]; locale?: string }) {
  const [columns, setColumns] = useState<Columns>(() => group(initialTasks));
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const selection = useSelectionState();

  const storageKey = "ws_dayboard_collapsed";
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { const s = localStorage.getItem(storageKey); if (s) setOverrides(JSON.parse(s)); } catch {}
  }, []);
  const isCollapsed = (k: BucketKey) => overrides[k] ?? columns[k].length === 0;
  function toggleCollapse(k: string) {
    setOverrides((prev) => {
      const cur = prev[k] ?? columns[k as BucketKey].length === 0;
      const next = { ...prev, [k]: !cur };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  useEffect(() => { setColumns(group(initialTasks)); }, [initialTasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const taskIndex = useMemo(() => {
    const map = new Map<string, BucketKey>();
    for (const k of KEYS) for (const t of columns[k]) map.set(t.id, k);
    return map;
  }, [columns]);

  function findColumn(id: string): BucketKey | undefined {
    if ((KEYS as string[]).includes(id)) return id as BucketKey;
    return taskIndex.get(id);
  }

  function onDragStart(e: DragStartEvent) {
    const t = e.active.data.current?.task as BoardTask | undefined;
    if (t) setActiveTask(t);
  }
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = findColumn(active.id as string);
    const to = findColumn(over.id as string);
    if (!from || !to || from === to) return;
    setColumns((prev) => {
      const activeItems = prev[from];
      const idx = activeItems.findIndex((t) => t.id === active.id);
      if (idx === -1) return prev;
      const moved = activeItems[idx];
      const overItems = prev[to];
      const overIdx = overItems.findIndex((t) => t.id === over.id);
      const insertAt = overIdx === -1 ? overItems.length : overIdx;
      return { ...prev, [from]: activeItems.filter((t) => t.id !== active.id), [to]: [...overItems.slice(0, insertAt), moved, ...overItems.slice(insertAt)] };
    });
  }
  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;
    const to = findColumn(over.id as string);
    if (!to) return;

    setColumns((prev) => {
      const items = prev[to];
      const a = items.findIndex((t) => t.id === active.id);
      const o = items.findIndex((t) => t.id === over.id);
      if (a !== -1 && o !== -1 && a !== o) return { ...prev, [to]: arrayMove(items, a, o) };
      return prev;
    });

    const due = dueForBucket(to);
    if (due === undefined) { toast.message(t(locale, "db.overdueCantSet")); return; }

    // Мультиперетаскивание: если тянут выбранную и выбрано >1 — переносим всі виділені
    const sel = selection.selected;
    const ids = sel.has(active.id as string) && sel.size > 1 ? [...sel] : [active.id as string];
    try {
      await Promise.all(ids.map((id) => updateTask({ taskId: id, dueDate: due })));
    } catch {
      toast.error(t(locale, "db.updateFailed"));
    }
    if (ids.length > 1) selection.clear();
  }

  if (!mounted) return <div className="min-h-40" />;

  return (
    <SelectionContext.Provider value={selection}>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {BUCKETS.map((b) => (
            <KanbanColumn
              key={b.key}
              id={b.key}
              label={t(locale, b.label)}
              dotClass={b.dot}
              tasks={columns[b.key]}
              collapsed={isCollapsed(b.key)}
              onToggle={toggleCollapse}
              showStatus
              locale={locale}
            />
          ))}
        </div>
        <DragOverlay>{activeTask ? <TaskCard task={activeTask} showStatus locale={locale} /> : null}</DragOverlay>
      </DndContext>
      <BulkBar />
    </SelectionContext.Provider>
  );
}
