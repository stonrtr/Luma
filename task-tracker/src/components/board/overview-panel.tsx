"use client";

import { useState } from "react";
import Link from "next/link";
import { isPast, isToday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PriorityBadge } from "@/components/task/priority-badge";
import { statusColors } from "@/lib/status-colors";
import { statusLabels } from "@/components/task/status-badge";
import { formatDaysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/generated/prisma/client";
import type { BoardTask } from "@/components/board/types";

const CHART_HEIGHT = 120;
const DONUT_COLOR = "#3b82f6";
const DONUT_TRACK = "#e5e5e5";

export function OverviewPanel({
  owner,
  stats,
  tasks,
}: {
  owner: { name: string; avatarUrl: string | null; role: string };
  stats: {
    createdCount: number;
    doneCount: number;
    onTimeCount: number;
    byStatus: Record<string, number>;
  };
  tasks: BoardTask[];
}) {
  const [hovered, setHovered] = useState<TaskStatus | null>(null);

  const entries = Object.entries(stats.byStatus) as [TaskStatus, number][];
  const max = Math.max(1, ...entries.map(([, count]) => count));
  const openCount = entries.reduce((sum, [, count]) => sum + count, 0);
  const totalCount = openCount + stats.doneCount;
  const openPct = totalCount === 0 ? 0 : (openCount / totalCount) * 100;

  const upcoming = tasks
    .filter((task) => task.status !== "DONE" && task.dueDate)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <UserAvatar name={owner.name} avatarUrl={owner.avatarUrl} size="lg" />
          <div>
            <p className="font-medium">{owner.name}</p>
            <p className="text-sm text-muted-foreground">
              {owner.role === "ADMIN" ? "Админ" : "Участник"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Создано задач
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {stats.createdCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Выполнено
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {stats.doneCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Выполнено в срок
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {stats.onTimeCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Открытые задачи
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <div
              className="relative size-16 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(${DONUT_COLOR} ${openPct}%, ${DONUT_TRACK} ${openPct}% 100%)`,
              }}
            >
              <div className="absolute inset-1.5 flex items-center justify-center rounded-full bg-card text-sm font-semibold">
                {openCount}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              из {totalCount} всего
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Открытые задачи по статусам</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-end gap-4"
            style={{ height: CHART_HEIGHT }}
            role="img"
            aria-label={entries
              .map(([status, count]) => `${statusLabels[status]}: ${count}`)
              .join(", ")}
          >
            {entries.map(([status, count]) => (
              <div
                key={status}
                className="relative flex flex-1 flex-col items-center gap-1.5"
                onMouseEnter={() => setHovered(status)}
                onMouseLeave={() => setHovered(null)}
              >
                {hovered === status && (
                  <div className="absolute -top-9 z-10 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md">
                    {statusLabels[status]}: {count}
                  </div>
                )}
                <span className="text-xs font-medium text-muted-foreground">
                  {count}
                </span>
                <div
                  className="flex w-full items-end justify-center"
                  style={{ height: CHART_HEIGHT - 24 }}
                >
                  <div
                    className={cn(
                      "w-8 rounded-t transition-opacity",
                      statusColors[status].swatch,
                      hovered && hovered !== status && "opacity-50",
                    )}
                    style={{
                      height: `${Math.max(4, (count / max) * (CHART_HEIGHT - 24))}px`,
                    }}
                  />
                </div>
                <span className="text-center text-xs text-muted-foreground">
                  {statusLabels[status]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Ближайшие задачи {upcoming.length > 0 && `· ${upcoming.length}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Нет задач с ближайшим сроком.
            </p>
          )}
          {upcoming.map((task) => {
            const overdue =
              task.dueDate && isPast(task.dueDate) && !isToday(task.dueDate);
            return (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent/50"
              >
                <Badge variant={overdue ? "destructive" : "outline"}>
                  {formatDaysUntil(task.dueDate!)}
                </Badge>
                <PriorityBadge priority={task.priority} />
                <span className="flex-1 truncate text-sm">{task.title}</span>
                <UserAvatar name={task.assignee.name} avatarUrl={task.assignee.avatarUrl} />
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
