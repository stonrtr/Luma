import "server-only";
import { db } from "@/server/db";
import { isNotificationEnabled } from "@/server/queries/notification-settings";

const MONTHS_UK = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];

// Обслуживание жизненного цикла: автоархив, просрочка, напоминание о KPI
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

  if (await isNotificationEnabled("overdue")) {
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

  // 4) Напоминание заполнить KPI за прошлый месяц (1–3 числа)
  if (now.getDate() >= 1 && now.getDate() <= 3 && (await isNotificationEnabled("kpi_reminder"))) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const unfilled = await db.kpi.count({
      where: { userId, year: prev.getFullYear(), month: prev.getMonth(), actualValue: null },
    });
    if (unfilled > 0) {
      const tag = `kpi:${prev.getFullYear()}-${prev.getMonth()}`;
      const exists = await db.notification.findFirst({
        where: { recipientId: userId, type: "kpi_reminder", message: { contains: tag } },
      });
      if (!exists) {
        await db.notification.create({
          data: {
            type: "kpi_reminder",
            message: `Заповніть виконання KPI за ${MONTHS_UK[prev.getMonth()]} · ${tag}`,
            link: "/planning",
            recipientId: userId,
          },
        });
      }
    }
  }
}
