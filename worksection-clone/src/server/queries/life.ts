import "server-only";
import { db } from "@/server/db";

// Стартовый набор сфер жизни (5 колонок). Порядок = порядок колонок на доске.
export const DEFAULT_SPHERES: { name: string; color: string }[] = [
  { name: "Здоровье", color: "#10b981" },   // emerald
  { name: "Работа", color: "#6366f1" },      // indigo
  { name: "Финансы", color: "#f59e0b" },     // amber
  { name: "Отношения", color: "#f43f5e" },   // rose
  { name: "Развитие", color: "#0ea5e9" },    // sky
];

// Найти (или создать при первом заходе) личный проект-планер пользователя.
// Возвращает проект вместе с тегами-сферами в стабильном порядке создания.
export async function getOrCreatePersonalProject(userId: string) {
  let project = await db.project.findFirst({
    where: { isPersonal: true, createdById: userId },
    include: { tags: { orderBy: { id: "asc" } } },
  });

  if (!project) {
    const created = await db.project.create({
      data: {
        name: "Моя жизнь",
        color: "#6366f1",
        isPersonal: true,
        createdById: userId,
        members: { create: [{ userId, role: "MANAGER" }] },
        tags: { create: DEFAULT_SPHERES },
      },
      include: { tags: { orderBy: { id: "asc" } } },
    });
    project = created;
  }

  return project;
}

// Задачи личного планера (верхнего уровня, не в архиве) со сферой-тегом.
export async function getLifeTasks(projectId: string) {
  return db.task.findMany({
    where: { projectId, parentId: null, archivedAt: null },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { position: "asc" }],
    include: {
      assignees: { include: { user: true } },
      tags: { include: { tag: true } },
      _count: { select: { subtasks: true, comments: true, checklist: true } },
      checklist: { select: { done: true } },
    },
  });
}

// Повторяющиеся шаблоны личного планера.
export async function getLifeRecurring(userId: string, projectId: string) {
  return db.recurringTask.findMany({
    where: { assigneeId: userId, projectId },
    orderBy: { createdAt: "desc" },
    include: { tag: true },
  });
}
