import "server-only";
import { db } from "@/server/db";

export function getBoardTasks(assigneeId: string) {
  return db.task.findMany({
    where: { assigneeId, archivedAt: null },
    orderBy: { position: "asc" },
    include: {
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });
}

export function getArchivedTasks(assigneeId: string) {
  return db.task.findMany({
    where: { assigneeId, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    include: {
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });
}

export function getTask(id: string) {
  return db.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });
}
