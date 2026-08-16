import "server-only";
import { db } from "@/server/db";
import { isNotificationEnabled, getNotificationChannels } from "@/server/queries/notification-settings";
import { notify } from "@/server/notify";
import { sendPushToUser } from "@/server/push";
import { sendTelegramToUser } from "@/server/telegram/api";
import { plannedLabel } from "@/lib/domain";
import { zonedWeekday, zonedMinutes } from "@/lib/tz";

const UA_TZ = "Europe/Kyiv";
const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Клавиатура «Так / Ні» под утренним планом (reply-кнопки, как в мастере бота)
const DAILY_YESNO_KB = { reply_markup: { keyboard: [[{ text: "Так" }, { text: "Ні" }]], resize_keyboard: true, one_time_keyboard: true } };

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
  flags?: { overdue: boolean; kpi: boolean; dailyPlan: boolean },
) {
  const f = flags ?? {
    overdue: await isNotificationEnabled("overdue"),
    kpi: await isNotificationEnabled("kpi_reminder"),
    dailyPlan: await isNotificationEnabled("daily_plan"),
  };
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  // Плановые пуши — только в рабочие будни по Украине. Ночью и на выходных молчим.
  if (zonedWeekday(now, UA_TZ) > 5) return;
  const kyivMin = zonedMinutes(now, UA_TZ); // минуты от полуночи по Киеву

  // План на сегодня — утром, с 10:00; одно уведомление в день. В Telegram — с вопросом и кнопками «Так/Ні».
  if (f.dailyPlan && kyivMin >= 600) {
    const already = await db.notification.findFirst({ where: { recipientId: userId, type: "daily_plan", createdAt: { gte: today } } });
    if (!already) {
      const endToday = new Date(today); endToday.setHours(23, 59, 59, 999);
      const tasks = await db.task.findMany({
        where: { archivedAt: null, status: { not: "DONE" }, dueDate: { lte: endToday }, assignees: { some: { userId } } },
        orderBy: [{ priority: "desc" }],
        select: { title: true, priority: true, plannedMinutes: true },
        take: 20,
      });
      if (tasks.length > 0) {
        const shown = tasks.slice(0, 12);
        const more = tasks.length > 12 ? `\n… +${tasks.length - 12}` : "";
        const dur = (m: number | null) => (m ? ` · ${plannedLabel(m, "uk")}` : "");
        // порядок: задача → пріоритет → час
        const plainLines = shown.map((t) => `• ${t.title} · п${t.priority}${dur(t.plannedMinutes)}`).join("\n");
        const planText = `Доброго ранку. Судячи з занесених задач, ось ваш план на день:\n${plainLines}${more}`;
        await db.notification.create({ data: { type: "daily_plan", message: planText, recipientId: userId, link: "/" } });

        const ch = await getNotificationChannels("daily_plan");
        if (ch.push) await sendPushToUser(userId, { title: "Доброго ранку", body: planText, url: "/" }).catch(() => {});
        if (ch.telegram) {
          const tgLines = shown.map((t) => `• ${escHtml(t.title)} · п${t.priority}${dur(t.plannedMinutes)}`).join("\n");
          const tgText = `<b>☀️ Доброго ранку</b>\nСудячи з занесених задач, ось ваш план на день:\n${tgLines}${more}\n\n<b>Бажаєте додати якусь задачу?</b>`;
          await sendTelegramToUser(userId, tgText, DAILY_YESNO_KB).catch(() => {});
        }
      }
    }
  }

  // «Не встигли сьогодні» — вечером, с 18:59; один мягкий итог за день, если есть незавершённые задачи с дедлайном сегодня/раньше
  if (f.overdue && kyivMin >= 18 * 60 + 59) {
    const already = await db.notification.findFirst({ where: { recipientId: userId, type: "overdue", createdAt: { gte: today } } });
    if (!already) {
      const endToday = new Date(today); endToday.setHours(23, 59, 59, 999);
      const tasks = await db.task.findMany({
        where: { archivedAt: null, status: { not: "DONE" }, dueDate: { lte: endToday }, assignees: { some: { userId } } },
        orderBy: [{ priority: "desc" }],
        select: { title: true, priority: true, plannedMinutes: true },
        take: 12,
      });
      if (tasks.length > 0) {
        // порядок: задача → пріоритет → час
        const list = tasks.map((t) => `• ${t.title} · п${t.priority}${t.plannedMinutes ? ` · ${plannedLabel(t.plannedMinutes, "uk")}` : ""}`).join("\n");
        const msg = `Упс. Здається, ви дещо не встигли сьогодні:\n${list}\n\nНагадаю вам зранку 🌙`;
        await notify({ recipientId: userId, type: "overdue", message: msg, link: "/" });
      }
    }
  }

  // Напоминание заполнить KPI за прошлый месяц — утром 1–3 числа
  if (f.kpi && kyivMin >= 600 && now.getDate() >= 1 && now.getDate() <= 3) {
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
