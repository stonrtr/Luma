"use client";

import { useMemo, useState, useEffect } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners,
  useDroppable, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Plus, SlidersHorizontal, Repeat, Layers } from "lucide-react";
import type { BoardTask } from "@/components/board/types";
import { LifeTaskCard } from "./life-task-card";
import { NewLifeTaskDialog } from "./new-life-task-dialog";
import { SphereManager } from "./sphere-manager";
import { RecurringManager, type RecurringItem } from "./recurring-manager";
import { Button } from "@/components/ui/button";
import { moveLifeTaskToSphere } from "@/server/actions/life";
import { mondayOf, addDays } from "@/lib/week";
import { cn } from "@/lib/utils";

export type Sphere = { id: string; name: string; color: string };
type Horizon = "today" | "week" | "month" | "all";
type LifeTask = BoardTask & { sphereId: string | null };

const NONE = "__none__";

const HORIZONS: { key: Horizon; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "all", label: "Всё" },
];

function dayStart(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function horizonMatch(task: LifeTask, horizon: Horizon): boolean {
  if (horizon === "all") return true;
  if (!task.dueDate) return false;
  const today = dayStart(new Date());
  const d = dayStart(new Date(task.dueDate));
  const done = task.status === "DONE";
  const overdueUndone = !done && d < today;
  if (horizon === "today") return overdueUndone || d.getTime() === today.getTime();
  if (horizon === "week") {
    const monday = mondayOf(today);
    const sunday = addDays(monday, 6);
    return overdueUndone || (d >= monday && d <= sunday);
  }
  // month
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return overdueUndone || (d >= first && d <= last);
}

// Сортировка внутри колонки: невыполненные выше, затем по дате (ближайшие сверху), затем приоритет.
function sortTasks(a: LifeTask, b: LifeTask): number {
  const ad = a.status === "DONE" ? 1 : 0, bd = b.status === "DONE" ? 1 : 0;
  if (ad !== bd) return ad - bd;
  const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
  const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
  if (at !== bt) return at - bt;
  return b.priority - a.priority;
}

function Column({
  sphere, tasks, recurringIds, onAdd,
}: {
  sphere: Sphere | { id: string; name: string; color: string };
  tasks: LifeTask[];
  recurringIds: Set<string>;
  onAdd?: (sphereId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: sphere.id, data: { type: "column", id: sphere.id } });
  const activeCount = tasks.filter((t) => t.status !== "DONE").length;

  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: sphere.color }} />
        <span className="text-sm font-semibold">{sphere.name}</span>
        <span className="text-xs text-muted-foreground">{activeCount}</span>
        {onAdd && (
          <button onClick={() => onAdd(sphere.id)} className="ml-auto text-muted-foreground transition-colors hover:text-foreground" title="Добавить задачу">
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn("flex min-h-24 flex-1 flex-col gap-2 rounded-xl bg-muted/40 p-2 transition-colors", isOver && "bg-accent/60 ring-2 ring-primary/30")}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => <LifeTaskCard key={t.id} task={t} isRecurring={recurringIds.has(t.id)} />)}
        </SortableContext>
        {tasks.length === 0 && onAdd && (
          <button onClick={() => onAdd(sphere.id)} className="rounded-lg border border-dashed py-6 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
            + Добавить задачу
          </button>
        )}
      </div>
    </div>
  );
}

export function SphereBoard({
  projectId, spheres, initialTasks, recurring, recurringIds,
}: {
  projectId: string;
  spheres: Sphere[];
  initialTasks: LifeTask[];
  recurring: RecurringItem[];
  recurringIds: string[];
}) {
  const [tasks, setTasks] = useState<LifeTask[]>(initialTasks);
  const [horizon, setHorizon] = useState<Horizon>("all");
  const [activeTask, setActiveTask] = useState<LifeTask | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const recSet = useMemo(() => new Set(recurringIds), [recurringIds]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filtered = useMemo(() => tasks.filter((t) => horizonMatch(t, horizon)), [tasks, horizon]);

  const bySphere = useMemo(() => {
    const map = new Map<string, LifeTask[]>();
    for (const s of spheres) map.set(s.id, []);
    map.set(NONE, []);
    for (const t of filtered) {
      const key = t.sphereId && map.has(t.sphereId) ? t.sphereId : NONE;
      map.get(key)!.push(t);
    }
    for (const list of map.values()) list.sort(sortTasks);
    return map;
  }, [filtered, spheres]);

  const hasNone = (bySphere.get(NONE)?.length ?? 0) > 0;

  function findSphereOf(taskId: string): string | null {
    return tasks.find((t) => t.id === taskId)?.sphereId ?? null;
  }

  function onDragStart(e: DragStartEvent) {
    const t = e.active.data.current?.task as LifeTask | undefined;
    if (t) setActiveTask(t);
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;
    const taskId = active.id as string;
    // определить целевую колонку: либо сама колонка, либо колонка карточки, над которой отпустили
    const overId = over.id as string;
    const targetSphere = spheres.some((s) => s.id === overId)
      ? overId
      : findSphereOf(overId);
    if (!targetSphere || targetSphere === NONE) return;
    const current = findSphereOf(taskId);
    if (current === targetSphere) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, sphereId: targetSphere } : t)));
    try {
      await moveLifeTaskToSphere({ taskId, sphereTagId: targetSphere });
    } catch {
      toast.error("Не удалось перенести задачу");
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, sphereId: current } : t)));
    }
  }

  if (!mounted) return <div className="min-h-40" />;

  return (
    <div className="flex flex-col gap-4">
      {/* Панель: фильтр горизонта + действия */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="size-3.5" /> Горизонт
        </span>
        <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
          {HORIZONS.map((h) => (
            <button
              key={h.key}
              onClick={() => setHorizon(h.key)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                horizon === h.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {h.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRecurringOpen(true)}>
            <Repeat className="size-4" /> Повторы
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
            <Layers className="size-4" /> Сферы
          </Button>
          <Button size="sm" onClick={() => setAddTo(spheres[0]?.id ?? "")} disabled={spheres.length === 0}>
            <Plus className="size-4" /> Задача
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {spheres.map((s) => (
            <Column key={s.id} sphere={s} tasks={bySphere.get(s.id) ?? []} recurringIds={recSet} onAdd={setAddTo} />
          ))}
          {hasNone && (
            <Column
              sphere={{ id: NONE, name: "Без сферы", color: "#94a3b8" }}
              tasks={bySphere.get(NONE) ?? []}
              recurringIds={recSet}
            />
          )}
        </div>
        <DragOverlay>{activeTask ? <LifeTaskCard task={activeTask} isRecurring={recSet.has(activeTask.id)} /> : null}</DragOverlay>
      </DndContext>

      {addTo !== null && (
        <NewLifeTaskDialog projectId={projectId} spheres={spheres} defaultSphereId={addTo} onClose={() => setAddTo(null)} />
      )}
      {manageOpen && <SphereManager projectId={projectId} spheres={spheres} onClose={() => setManageOpen(false)} />}
      {recurringOpen && <RecurringManager projectId={projectId} spheres={spheres} items={recurring} onClose={() => setRecurringOpen(false)} />}
    </div>
  );
}
