import "server-only";
import { db } from "@/server/db";
import { sendPushToUser } from "@/server/push";
import { sendTelegramToUser } from "@/server/telegram/api";
import { getNotificationChannels } from "@/server/queries/notification-settings";

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
  await Promise.all([
    channels.push
      ? sendPushToUser(n.recipientId, { title, body: n.message, url: n.link ?? "/" }).catch(() => {})
      : Promise.resolve(),
    channels.telegram
      ? sendTelegramToUser(n.recipientId, `🔔 <b>${title}</b>\n${n.message}`).catch(() => {})
      : Promise.resolve(),
  ]);
  return created;
}
