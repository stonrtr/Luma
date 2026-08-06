import "server-only";
import { db } from "@/server/db";

// Обслуживание жизненного цикла: автоархив и уведомления о просрочке
export async function runLifecycleMaintenance(userId: string) {
  const now = new Date();

  // 1) Завершённые задачи старше 7 дней → в архив
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  await db.task.updateMany({
    where: { status: "DONE", archivedAt: null, completedAt: { lt: weekAgo } },
    data: { archivedAt: now },
  });

  // 2) Завершённые проекты → в архив
  await db.project.updateMany({
    where: { status: "DONE", archivedAt: null },
    data: { archivedAt: now, status: "ARCHIVED" },
  });

  // 3) Просроченные задачи текущего пользователя → уведомление (не чаще 1 на задачу без прочтения)
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const overdue = await db.task.findMany({
    where: {
      archivedAt: null,
      status: { not: "DONE" },
      dueDate: { lt: today },
      assignees: { some: { userId } },
    },
    select: { id: true, title: true },
    take: 20,
  });

  for (const t of overdue) {
    const link = `/tasks/${t.id}`;
    const exists = await db.notification.findFirst({
      where: { recipientId: userId, type: "overdue", link, readAt: null },
    });
    if (!exists) {
      await db.notification.create({
        data: { type: "overdue", message: `Задача прострочена: «${t.title}»`, link, recipientId: userId },
      });
    }
  }
}
