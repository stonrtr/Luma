import "server-only";
import { db } from "@/server/db";

// Задачи верхнего уровня проекта для канбан-доски
export async function getBoardTasks(projectId: string) {
  return db.task.findMany({
    where: { projectId, parentId: null, archivedAt: null },
    orderBy: [{ priority: "desc" }, { position: "asc" }],
    include: {
      assignees: { include: { user: true } },
      tags: { include: { tag: true } },
      _count: { select: { subtasks: true, comments: true, checklist: true } },
      checklist: { select: { done: true } },
    },
  });
}

// Личные задачи пользователя (из всех проектов + без проекта), назначенные на него
export async function getMyTasks(userId: string) {
  return db.task.findMany({
    where: { parentId: null, archivedAt: null, assignees: { some: { userId } } },
    orderBy: [{ priority: "desc" }, { position: "asc" }],
    include: {
      project: { select: { name: true, color: true } },
      assignees: { include: { user: true } },
      tags: { include: { tag: true } },
      _count: { select: { subtasks: true, comments: true, checklist: true } },
      checklist: { select: { done: true } },
    },
  });
}

// Все задачи команды (для агрегированной доски «Всі» на вкладці Команда)
export async function getAllTasks() {
  return db.task.findMany({
    where: { parentId: null, archivedAt: null },
    orderBy: [{ priority: "desc" }, { position: "asc" }],
    include: {
      project: { select: { name: true, color: true } },
      assignees: { include: { user: true } },
      tags: { include: { tag: true } },
      _count: { select: { subtasks: true, comments: true, checklist: true } },
      checklist: { select: { done: true } },
    },
  });
}

export async function getTaskDetail(taskId: string) {
  return db.task.findUnique({
    where: { id: taskId },
    include: {
      project: { include: { members: { include: { user: true } }, tags: true } },
      assignees: { include: { user: true } },
      createdBy: true,
      milestone: true,
      tags: { include: { tag: true } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      checklist: { orderBy: { position: "asc" } },
      subtasks: {
        orderBy: { position: "asc" },
        include: { assignees: { include: { user: true } } },
      },
      parent: { select: { id: true, title: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: true },
      },
      timeLogs: {
        orderBy: { loggedAt: "desc" },
        include: { user: true },
      },
      dependsOn: { include: { predecessor: true } },
      dependedBy: { include: { successor: true } },
    },
  });
}

export async function getUserTaskStats(userId: string) {
  const [assigned, inProgress, overdue] = await Promise.all([
    db.taskAssignee.count({ where: { userId, task: { status: { not: "DONE" } } } }),
    db.taskAssignee.count({ where: { userId, task: { status: "IN_PROGRESS" } } }),
    db.taskAssignee.count({
      where: { userId, task: { status: { not: "DONE" }, dueDate: { lt: new Date() } } },
    }),
  ]);
  return { assigned, inProgress, overdue };
}
