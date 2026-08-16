import "server-only";
import { db } from "@/server/db";
import { archiveCompleted, remindUser, pruneOldRecords } from "@/server/lifecycle-engine";
import { generateDueRecurringTasks } from "@/server/recurring-engine";
import { getNotificationConfig } from "@/server/queries/notification-settings";

// Полный плановый прогон (для cron): архив, регулярные задачи, напоминания всем.
// Идемпотентен — повторные запуски не создают дублей уведомлений.
export async function runScheduledMaintenance() {
  const now = new Date();

  await archiveCompleted(now);
  await pruneOldRecords(now).catch(() => {}); // авто-очистка журнала + прочитанных уведомлений (30 дн)
  const recurring = await generateDueRecurringTasks().catch(() => 0);

  const configs = {
    daily_plan: await getNotificationConfig("daily_plan"),
    overdue: await getNotificationConfig("overdue"),
    kpi_reminder: await getNotificationConfig("kpi_reminder"),
  };

  const users = await db.user.findMany({
    where: { isActive: true, role: { not: "CLIENT" } },
    select: { id: true },
  });
  for (const u of users) {
    await remindUser(u.id, now, configs).catch(() => {});
  }

  return { ranAt: now.toISOString(), users: users.length, recurringCreated: typeof recurring === "number" ? recurring : null };
}
