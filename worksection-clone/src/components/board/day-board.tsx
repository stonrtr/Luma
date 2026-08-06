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
import { SelectionProvider } from "./selection-context";
import { BulkBar } from "./bulk-bar";
import { updateTask } from "@/server/actions/tasks";
import { mondayOf, addDays } from "@/lib/week";

// Бакеты по срокам. Порядок: Інше, Прострочено, Сьогодні, Завтра, На тиждень, На місяць
const BUCKETS = [
  { key: "other", label: "Інше", dot: "bg-slate-400" },
  { key: "overdue", label: "Прострочено", dot: "bg-red-500" },
  { key: "today", label: "Сьогодні", dot: "bg-blue-500" },
  { key: "tomorrow", label: "Завтра", dot: "bg-indigo-500" },
  { key: "week", label: "На тиждень", dot: "bg-emerald-500" },
  { key: "month", label: "На місяць", dot: "bg-amber-500" },
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
  const weekEnd = addDays(mondayOf(today), 7); // конец текущей недели (пн след. недели)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  if (t.status !== "DONE" && d < today) return "overdue";
  if (d.getTime() === today.getTime()) return "today";
  if (d.getTime() === tomorrow.getTime()) return "tomorrow";
  if (d > tomorrow && d < weekEnd) return "week";
  if (d >= weekEnd && d < monthEnd) return "month";
  return "other";
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
    case "week": return iso(addDays(mondayOf(today), 6)); // воскресенье текущей недели
    case "month": return iso(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  }
}

function group(tasks: BoardTask[]): Columns {
  const cols = Object.fromEntries(KEYS.map((k) => [k, [] as BoardTask[]])) as Columns;
  for (const t of tasks) cols[bucketOf(t)].push(t);
  for (const k of KEYS) cols[k].sort((a, b) => b.priority - a.priority || a.position - b.position);
  return cols;
}

export function DayBoard({ initialTasks }: { initialTasks: BoardTask[] }) {
  const [columns, setColumns] = useState<Columns>(() => group(initialTasks));
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
    if (due === undefined) { toast.message("Дату «Прострочено» не можна встановити"); return; }
    try {
      await updateTask({ taskId: active.id as string, dueDate: due });
    } catch {
      toast.error("Не вдалося оновити термін");
    }
  }

  if (!mounted) return <div className="min-h-40" />;

  return (
    <SelectionProvider>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {BUCKETS.map((b) => (
            <KanbanColumn
              key={b.key}
              id={b.key}
              label={b.label}
              dotClass={b.dot}
              tasks={columns[b.key]}
              collapsed={isCollapsed(b.key)}
              onToggle={toggleCollapse}
            />
          ))}
        </div>
        <DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay>
      </DndContext>
      <BulkBar />
    </SelectionProvider>
  );
}
