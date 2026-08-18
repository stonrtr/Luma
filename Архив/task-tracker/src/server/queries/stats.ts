import "server-only";
import { db } from "@/server/db";
import { TaskStatus } from "@/generated/prisma/client";

const openStatuses = [
  TaskStatus.IDEA,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.TO_APPROVE,
  TaskStatus.PAUSED,
] as const;

export async function getBoardStats(assigneeId: string) {
  const [createdCount, doneTasks, statusCounts] = await Promise.all([
    db.task.count({ where: { assigneeId, createdById: assigneeId } }),
    db.task.findMany({
      where: { assigneeId, status: TaskStatus.DONE },
      select: { dueDate: true, completedAt: true },
    }),
    db.task.groupBy({
      by: ["status"],
      where: { assigneeId, status: { in: [...openStatuses] } },
      _count: { _all: true },
    }),
  ]);

  const doneCount = doneTasks.length;
  const onTimeCount = doneTasks.filter(
    (task) =>
      task.dueDate && task.completedAt && task.completedAt <= task.dueDate,
  ).length;

  const byStatus = Object.fromEntries(
    openStatuses.map((status) => [status, 0]),
  ) as Record<(typeof openStatuses)[number], number>;

  for (const row of statusCounts) {
    byStatus[row.status as (typeof openStatuses)[number]] = row._count._all;
  }

  return { createdCount, doneCount, onTimeCount, byStatus };
}
