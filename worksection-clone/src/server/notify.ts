import "server-only";
import { db } from "@/server/db";
import { sendPushToUser } from "@/server/push";
import { sendTelegramToUser } from "@/server/telegram/api";
import { getNotificationChannels } from "@/server/queries/notification-settings";
import { zonedMinutes } from "@/lib/tz";

// «Тихие часы» Telegram: событийные пуши в бот шлём только 9:00–19:00 по времени
// получателя. В приложение (web-push + колокол) — всегда, в момент события.
const TG_FROM_MIN = 9 * 60;   // 09:00
const TG_TO_MIN = 19 * 60;    // 19:00
function telegramAllowedNow(timeZone: string): boolean {
  const m = zonedMinutes(new Date(), timeZone);
  return m >= TG_FROM_MIN && m < TG_TO_MIN;
}

const TITLES: Record<string, string> = {
  assignment: "Нова задача",
  overdue: "Підсумок дня",
  review: "Задача на перевірку",
  review_result: "Результат перевірки",
  kpi_reminder: "Нагадування про KPI",
  mention: "Вас згадали",
  daily_plan: "План на сьогодні",
};

// Единая точка: пишет уведомление в БД и шлёт web-push (best-effort).
export async function notify(n: {
  recipientId: string;
  type: string;
  message: string;
  link?: string | null;
  actorId?: string | null;
}) {
  const created = await db.notification.create({
    data: {
      type: n.type,
      message: n.message,
      link: n.link ?? null,
      recipientId: n.recipientId,
      actorId: n.actorId ?? null,
    },
  });
  const title = TITLES[n.type] ?? "Сповіщення";
  // Каналы доставки настраиваются админом по типу: пуш в приложении и/или Telegram
  const channels = await getNotificationChannels(n.type);
  // Telegram — только в «тихие часы» 9–19 по TZ получателя; приложение — всегда
  const tz = (await db.user.findUnique({ where: { id: n.recipientId }, select: { timezone: true } }))?.timezone || "Europe/Kyiv";
  await Promise.all([
    channels.push
      ? sendPushToUser(n.recipientId, { title, body: n.message, url: n.link ?? "/" }).catch(() => {})
      : Promise.resolve(),
    channels.telegram && telegramAllowedNow(tz)
      ? sendTelegramToUser(n.recipientId, `🔔 <b>${title}</b>\n${n.message}`).catch(() => {})
      : Promise.resolve(),
  ]);
  return created;
}
