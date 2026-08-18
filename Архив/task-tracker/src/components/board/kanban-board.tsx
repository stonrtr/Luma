"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { KanbanColumn } from "@/components/board/kanban-column";
import { TaskCard } from "@/components/board/task-card";
import { DayBoard } from "@/components/board/day-board";
import { CalendarBoard } from "@/components/board/calendar-board";
import { RecurringPanel } from "@/components/board/recurring-panel";
import { OverviewPanel } from "@/components/board/overview-panel";
import { ArchivePanel } from "@/components/board/archive-panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveTask, bulkCloseTasks, bulkMoveTasks } from "@/server/actions/tasks";
import { TaskStatus } from "@/generated/prisma/enums";
import { statusLabels } from "@/components/task/status-badge";
import type { BoardTask } from "@/components/board/types";
import type { RecurringTask } from "@/generated/prisma/client";

const columnOrder: TaskStatus[] = [
  TaskStatus.IDEA,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.TO_APPROVE,
  TaskStatus.DONE,
  TaskStatus.PAUSED,
];

type Columns = Record<TaskStatus, BoardTask[]>;
type SortBy = "position" | "name" | "dueDate";
type ViewMode = "overview" | "kanban" | "days" | "calendar" | "recurring";
type OpenFilter = "open" | "archive" | "all";

type ArchivedTask = {
  id: string;
  title: string;
  priority: number;
  archivedAt: Date | null;
  assignee: { name: string; avatarUrl: string | null };
};

function groupByStatus(tasks: BoardTask[]): Columns {
  const columns = {
    IDEA: [],
    TODO: [],
    IN_PROGRESS: [],
    TO_APPROVE: [],
    DONE: [],
    PAUSED: [],
  } as Columns;
  for (const task of tasks) {
    columns[task.status].push(task);
  }
  return columns;
}

function findContainer(columns: Columns, id: string): TaskStatus | undefined {
  if (id in columns) return id as TaskStatus;
  return columnOrder.find((status) =>
    columns[status].some((task) => task.id === id),
  );
}

function sortTasks(tasks: BoardTask[], sortBy: SortBy): BoardTask[] {
  if (sortBy === "position") return tasks;
  const sorted = [...tasks];
  if (sortBy === "name") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  } else {
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }
  return sorted;
}

export function KanbanBoard({
  boardUserId,
  owner,
  initialTasks,
  users,
  recurringTasks,
  stats,
  archivedTasks,
}: {
  boardUserId: string;
  owner: { name: string; avatarUrl: string | null; role: string };
  initialTasks: BoardTask[];
  users: { id: string; name: string }[];
  recurringTasks: RecurringTask[];
  stats: {
    createdCount: number;
    doneCount: number;
    onTimeCount: number;
    byStatus: Record<string, number>;
  };
  archivedTasks: ArchivedTask[];
}) {
  const [columns, setColumns] = useState<Columns>(() =>
    groupByStatus(initialTasks),
  );
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [groupDragIds, setGroupDragIds] = useState<string[] | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("position");
  const [openFilter, setOpenFilter] = useState<OpenFilter>("open");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState(false);
  const [collapsedOverrides, setCollapsedOverrides] = useState<
    Map<TaskStatus, boolean>
  >(new Map());

  function toggleCollapsed(status: TaskStatus, currentlyCollapsed: boolean) {
    setCollapsedOverrides((prev) => {
      const next = new Map(prev);
      next.set(status, !currentlyCollapsed);
      return next;
    });
  }

  useEffect(() => {
    setColumns(groupByStatus(initialTasks));
  }, [initialTasks]);

  const displayColumns = useMemo(() => {
    const result = {} as Columns;
    for (const status of columnOrder) {
      const isDoneColumn = status === TaskStatus.DONE;
      const included = openFilter !== "open" || !isDoneColumn;
      result[status] = included ? sortTasks(columns[status], sortBy) : [];
    }
    return result;
  }, [columns, sortBy, openFilter]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  function toggleSelected(taskId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  async function handleBulkClose() {
    setClosing(true);
    try {
      await bulkCloseTasks({ taskIds: [...selectedIds] });
      setSelectedIds(new Set());
    } catch {
      toast.error("Не удалось закрыть задачи");
    } finally {
      setClosing(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    const container = findContainer(columns, activeId);
    if (!container) return;
    const task = columns[container].find((task) => task.id === activeId);
    setActiveTask(task ?? null);

    if (selectedIds.has(activeId) && selectedIds.size > 1) {
      setGroupDragIds([...selectedIds]);
    } else {
      setGroupDragIds(null);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (groupDragIds) return;

    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(columns, String(active.id));
    const overContainer = findContainer(columns, String(over.id));

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setColumns((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      const overIndex = overItems.findIndex((t) => t.id === over.id);

      const task = activeItems[activeIndex];
      if (!task) return prev;

      const newIndex = overIndex >= 0 ? overIndex : overItems.length;

      return {
        ...prev,
        [activeContainer]: activeItems.filter((t) => t.id !== active.id),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          { ...task, status: overContainer },
          ...overItems.slice(newIndex),
        ],
      };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    const ids = groupDragIds;
    setGroupDragIds(null);
    if (!over) return;

    if (ids && ids.length > 1) {
      const toStatus = findContainer(columns, String(over.id));
      if (!toStatus) return;

      const movingSet = new Set(ids);
      const movedTasks = ids
        .map((id) => {
          const status = findContainer(columns, id);
          return status ? columns[status].find((t) => t.id === id) : undefined;
        })
        .filter((t): t is BoardTask => !!t);

      const nextColumns = {} as Columns;
      for (const status of columnOrder) {
        nextColumns[status] = columns[status].filter(
          (t) => !movingSet.has(t.id),
        );
      }
      nextColumns[toStatus] = [
        ...nextColumns[toStatus],
        ...movedTasks.map((t) => ({ ...t, status: toStatus })),
      ];
      setColumns(nextColumns);

      try {
        await bulkMoveTasks({ taskIds: ids, toStatus });
        setSelectedIds(new Set());
      } catch {
        toast.error("Не удалось переместить задачи");
        setColumns(groupByStatus(initialTasks));
      }
      return;
    }

    const container = findContainer(columns, String(active.id));
    if (!container) return;

    const items = columns[container];
    const activeIndex = items.findIndex((t) => t.id === active.id);
    const overIndex = items.findIndex((t) => t.id === over.id);

    let orderedIds = items.map((t) => t.id);

    if (activeIndex !== overIndex && overIndex >= 0) {
      const reordered = arrayMove(items, activeIndex, overIndex);
      orderedIds = reordered.map((t) => t.id);
      setColumns((prev) => ({ ...prev, [container]: reordered }));
    }

    try {
      await moveTask({
        taskId: String(active.id),
        toStatus: container,
        orderedTaskIds: orderedIds,
      });
    } catch {
      toast.error("Не удалось сохранить перемещение задачи");
      setColumns(groupByStatus(initialTasks));
    }
  }

  const tabs: { mode: ViewMode; label: string }[] = [
    { mode: "overview", label: "Огляд" },
    { mode: "kanban", label: "Канбан" },
    { mode: "days", label: "По дням" },
    { mode: "calendar", label: "Календарь" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b">
        <nav className="flex items-center gap-5">
          {tabs.map((tab) => (
            <button
              key={tab.mode}
              type="button"
              onClick={() => setViewMode(tab.mode)}
              className={`-mb-px border-b-2 pb-2 text-sm font-medium transition-colors ${
                viewMode === tab.mode
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <Button
          type="button"
          variant={viewMode === "recurring" ? "secondary" : "ghost"}
          size="sm"
          className="-mb-px"
          onClick={() => setViewMode("recurring")}
        >
          Регулярные
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {viewMode === "kanban" && (
          <>
            <Select
              value={openFilter}
              onValueChange={(v) => setOpenFilter(v as OpenFilter)}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Открытые</SelectItem>
                <SelectItem value="archive">Архив</SelectItem>
                <SelectItem value="all">Все задачи</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="position">По порядку</SelectItem>
                <SelectItem value="name">По названию</SelectItem>
                <SelectItem value="dueDate">По сроку</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        {selectedIds.size > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-md border bg-accent px-3 py-1.5">
            <span className="text-sm font-medium">
              Выбрано: {selectedIds.size}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={closing}
              onClick={handleBulkClose}
            >
              {closing ? "Сохранение..." : "Зроблено"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Отмена
            </Button>
          </div>
        )}
      </div>

      {viewMode === "overview" ? (
        <OverviewPanel owner={owner} stats={stats} tasks={initialTasks} />
      ) : viewMode === "kanban" && openFilter === "archive" ? (
        <ArchivePanel tasks={archivedTasks} />
      ) : viewMode === "days" ? (
        <DayBoard
          tasks={initialTasks}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
        />
      ) : viewMode === "calendar" ? (
        <CalendarBoard
          tasks={initialTasks}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
        />
      ) : viewMode === "recurring" ? (
        <RecurringPanel boardUserId={boardUserId} templates={recurringTasks} />
      ) : (
        <DndContext
          id="kanban-board"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columnOrder.map((status) => {
              const defaultCollapsed = displayColumns[status].length === 0;
              const collapsed =
                collapsedOverrides.get(status) ?? defaultCollapsed;
              return (
                <KanbanColumn
                  key={status}
                  status={status}
                  title={statusLabels[status]}
                  tasks={displayColumns[status]}
                  boardUserId={boardUserId}
                  users={users}
                  selectedIds={selectedIds}
                  onToggleSelected={toggleSelected}
                  collapsed={collapsed}
                  onToggleCollapsed={() => toggleCollapsed(status, collapsed)}
                />
              );
            })}
          </div>
          <DragOverlay>
            {groupDragIds && groupDragIds.length > 1 ? (
              <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium shadow-lg ring-1 ring-foreground/10">
                Перемещение задач: {groupDragIds.length}
              </div>
            ) : (
              activeTask && <TaskCard task={activeTask} />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
