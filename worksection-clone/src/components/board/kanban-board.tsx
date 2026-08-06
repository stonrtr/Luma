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
import type { TaskStatus } from "@/generated/prisma/enums";
import type { BoardTask, BoardMember } from "./types";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { NewTaskDialog } from "./new-task-dialog";
import { TASK_STATUSES } from "@/lib/domain";
import { moveTask } from "@/server/actions/tasks";

type Columns = Record<TaskStatus, BoardTask[]>;

function group(tasks: BoardTask[]): Columns {
  const cols = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as BoardTask[]])) as Columns;
  for (const t of tasks) cols[t.status].push(t);
  // высокий приоритет выше; при равном — по позиции
  for (const s of TASK_STATUSES) cols[s].sort((a, b) => b.priority - a.priority || a.position - b.position);
  return cols;
}

export function KanbanBoard({
  projectId,
  initialTasks,
  members,
  lockedAssigneeId,
}: {
  projectId: string;
  initialTasks: BoardTask[];
  members: BoardMember[];
  lockedAssigneeId?: string;
}) {
  const [columns, setColumns] = useState<Columns>(() => group(initialTasks));
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [dialogStatus, setDialogStatus] = useState<TaskStatus | null>(null);
  // рендерим доску (drag-and-drop) лише на клієнті — dnd-kit генерує id, що не збігаються при SSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // сворачивание колонок: пустые скрыты по умолчанию, выбор пользователя запоминается
  const storageKey = `ws_board_collapsed_${projectId || "me"}`;
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const s = localStorage.getItem(storageKey);
      if (s) setOverrides(JSON.parse(s));
    } catch {}
  }, [storageKey]);
  const isCollapsed = (status: TaskStatus) =>
    overrides[status] ?? columns[status].length === 0;
  function toggleCollapse(status: TaskStatus) {
    setOverrides((prev) => {
      const cur = prev[status] ?? columns[status].length === 0;
      const next = { ...prev, [status]: !cur };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // синхронизация с сервером после revalidate (перемещения, создание задач)
  useEffect(() => {
    setColumns(group(initialTasks));
  }, [initialTasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const taskIndex = useMemo(() => {
    const map = new Map<string, TaskStatus>();
    for (const s of TASK_STATUSES) for (const t of columns[s]) map.set(t.id, s);
    return map;
  }, [columns]);

  function findColumn(id: string): TaskStatus | undefined {
    if (TASK_STATUSES.includes(id as TaskStatus)) return id as TaskStatus;
    return taskIndex.get(id);
  }

  function onDragStart(e: DragStartEvent) {
    const task = e.active.data.current?.task as BoardTask | undefined;
    if (task) setActiveTask(task);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = findColumn(active.id as string);
    const to = findColumn(over.id as string);
    if (!from || !to || from === to) return;

    setColumns((prev) => {
      const activeItems = prev[from];
      const overItems = prev[to];
      const activeIdx = activeItems.findIndex((t) => t.id === active.id);
      if (activeIdx === -1) return prev;
      const moved = { ...activeItems[activeIdx], status: to };
      const overIdx = overItems.findIndex((t) => t.id === over.id);
      const insertAt = overIdx === -1 ? overItems.length : overIdx;
      return {
        ...prev,
        [from]: activeItems.filter((t) => t.id !== active.id),
        [to]: [...overItems.slice(0, insertAt), moved, ...overItems.slice(insertAt)],
      };
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;

    const to = findColumn(over.id as string);
    if (!to) return;

    let toIndex = columns[to].findIndex((t) => t.id === over.id);
    if (toIndex === -1) toIndex = columns[to].length;

    // финальная перестановка внутри колонки
    setColumns((prev) => {
      const items = prev[to];
      const activeIdx = items.findIndex((t) => t.id === active.id);
      const overIdx = items.findIndex((t) => t.id === over.id);
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        return { ...prev, [to]: arrayMove(items, activeIdx, overIdx) };
      }
      return prev;
    });

    const finalIndex = columns[to].findIndex((t) => t.id === active.id);
    try {
      await moveTask({
        taskId: active.id as string,
        toStatus: to,
        toIndex: finalIndex === -1 ? toIndex : finalIndex,
      });
    } catch {
      toast.error("Не удалось переместить задачу");
    }
  }

  if (!mounted) {
    // плейсхолдер під час гідрації (щоб не було стрибка розмітки)
    return <div className="min-h-40" />;
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={columns[status]}
              onAdd={setDialogStatus}
              collapsed={isCollapsed(status)}
              onToggle={toggleCollapse}
            />
          ))}
        </div>
        <DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay>
      </DndContext>

      <NewTaskDialog
        projectId={projectId}
        members={members}
        status={dialogStatus}
        onClose={() => setDialogStatus(null)}
        lockedAssigneeId={lockedAssigneeId}
      />
    </>
  );
}
