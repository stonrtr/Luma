import "server-only";
import { db } from "@/server/db";

export async function getGanttData(projectId: string) {
  const [tasks, deps, milestones] = await Promise.all([
    db.task.findMany({
      where: { projectId, parentId: null, archivedAt: null },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      include: { assignees: { include: { user: true } } },
    }),
    db.taskDependency.findMany({
      where: { predecessor: { projectId }, successor: { projectId } },
    }),
    db.milestone.findMany({ where: { projectId }, orderBy: { dueDate: "asc" } }),
  ]);
  return { tasks, deps, milestones };
}
