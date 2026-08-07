import "server-only";
import { db } from "@/server/db";
import { archiveCompleted, remindUser } from "@/server/lifecycle-engine";
import { generateDueRecurringTasks } from "@/server/recurring-engine";
import { isNotificationEnabled } from "@/server/queries/notification-settings";

// Полный плановый прогон (для cron): архив, регулярные задачи, напоминания всем.
// Идемпотентен — повторные запуски не создают дублей уведомлений.
export async function runScheduledMaintenance() {
  const now = new Date();

  await archiveCompleted(now);
  const recurring = await generateDueRecurringTasks().catch(() => 0);

  const flags = {
    overdue: await isNotificationEnabled("overdue"),
    managerOverdue: await isNotificationEnabled("manager_overdue"),
    kpi: await isNotificationEnabled("kpi_reminder"),
  };

  const users = await db.user.findMany({
    where: { isActive: true, role: { not: "CLIENT" } },
    select: { id: true },
  });
  for (const u of users) {
    await remindUser(u.id, now, flags).catch(() => {});
  }

  return { ranAt: now.toISOString(), users: users.length, recurringCreated: typeof recurring === "number" ? recurring : null };
}
