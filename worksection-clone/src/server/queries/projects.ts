import "server-only";
import { db } from "@/server/db";

// Проекты, в которых пользователь состоит участником (или все — для админа)
export async function getProjectsForUser(userId: string, opts?: { all?: boolean }) {
  const projects = await db.project.findMany({
    where: opts?.all ? {} : { members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: { include: { user: true } },
      _count: { select: { tasks: true } },
    },
  });

  // прогресс по каждому проекту (доля выполненных задач)
  const withProgress = await Promise.all(
    projects.map(async (p) => {
      const [done, total] = await Promise.all([
        db.task.count({ where: { projectId: p.id, status: "DONE", parentId: null } }),
        db.task.count({ where: { projectId: p.id, parentId: null } }),
      ]);
      return { ...p, doneCount: done, totalCount: total };
    }),
  );

  return withProgress;
}

export async function getProjectById(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      members: { include: { user: true } },
      milestones: true,
      tags: true,
    },
  });
}

export async function isProjectMember(projectId: string, userId: string) {
  const m = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return !!m;
}
