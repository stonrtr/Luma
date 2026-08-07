import "server-only";
import { db } from "@/server/db";
import { isNotificationEnabled } from "@/server/queries/notification-settings";
import { notify } from "@/server/notify";

const MONTHS_UK = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];

// Глобальное обслуживание: автоархив завершённых задач и проектов
export async function archiveCompleted(now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  await db.task.updateMany({
    where: { status: "DONE", archivedAt: null, completedAt: { lt: weekAgo } },
    data: { archivedAt: now },
  });
  await db.project.updateMany({
    where: { status: "DONE", archivedAt: null },
    data: { archivedAt: now, status: "ARCHIVED" },
  });
}

// Напоминания одному пользователю: просрочка, просрочка у подчинённых, KPI.
// Флаги передаются извне, чтобы не читать настройки в цикле по всем сотрудникам.
export async function remindUser(
  userId: string,
  now = new Date(),
  flags?: { overdue: boolean; managerOverdue: boolean; kpi: boolean },
) {
  const f = flags ?? {
    overdue: await isNotificationEnabled("overdue"),
    managerOverdue: await isNotificationEnabled("manager_overdue"),
    kpi: await isNotificationEnabled("kpi_reminder"),
  };
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  // Просроченные задачи пользователя → уведомление (не чаще 1 непрочитанного на задачу)
  if (f.overdue) {
    const overdue = await db.task.findMany({
      where: { archivedAt: null, status: { not: "DONE" }, dueDate: { lt: today }, assignees: { some: { userId } } },
      select: { id: true, title: true },
      take: 50,
    });
    for (const t of overdue) {
      const link = `/tasks/${t.id}`;
      const exists = await db.notification.findFirst({ where: { recipientId: userId, type: "overdue", link, readAt: null } });
      if (!exists) {
        await notify({ recipientId: userId, type: "overdue", message: `Задача прострочена: «${t.title}»`, link });
      }
    }
  }

  // Просроченные задачи, которые пользователь поставил подчинённым → уведомляем его (руководителя)
  if (f.managerOverdue) {
    const managerOverdue = await db.task.findMany({
      where: { createdById: userId, assignedByManager: true, archivedAt: null, status: { not: "DONE" }, dueDate: { lt: today } },
      include: { assignees: { include: { user: { select: { name: true } } } } },
      take: 50,
    });
    for (const t of managerOverdue) {
      const link = `/tasks/${t.id}`;
      const exists = await db.notification.findFirst({ where: { recipientId: userId, type: "manager_overdue", link, readAt: null } });
      if (!exists) {
        const who = t.assignees[0]?.user.name ?? "виконавець";
        await notify({ recipientId: userId, type: "manager_overdue", message: `Прострочено у «${who}»: «${t.title}»`, link });
      }
    }
  }

  // Напоминание заполнить KPI за прошлый месяц (1–3 числа)
  if (f.kpi && now.getDate() >= 1 && now.getDate() <= 3) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const unfilled = await db.kpi.count({ where: { userId, year: prev.getFullYear(), month: prev.getMonth(), actualValue: null } });
    if (unfilled > 0) {
      const tag = `kpi:${prev.getFullYear()}-${prev.getMonth()}`;
      const exists = await db.notification.findFirst({ where: { recipientId: userId, type: "kpi_reminder", message: { contains: tag } } });
      if (!exists) {
        await notify({ recipientId: userId, type: "kpi_reminder", message: `Заповніть виконання KPI за ${MONTHS_UK[prev.getMonth()]} · ${tag}`, link: "/planning" });
      }
    }
  }
}

// Обслуживание при заходе пользователя в приложение (фолбэк к планировщику)
export async function runLifecycleMaintenance(userId: string) {
  const now = new Date();
  await archiveCompleted(now);
  await remindUser(userId, now);
}
