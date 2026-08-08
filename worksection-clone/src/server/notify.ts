import "server-only";
import { db } from "@/server/db";
import { sendPushToUser } from "@/server/push";
import { sendTelegramToUser } from "@/server/telegram/api";

const TITLES: Record<string, string> = {
  assignment: "Нова задача",
  overdue: "Прострочена задача",
  manager_overdue: "Прострочено у підлеглого",
  review: "Задача на перевірку",
  kpi_reminder: "Нагадування про KPI",
  comment: "Новий коментар",
  mention: "Вас згадали",
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
  await Promise.all([
    sendPushToUser(n.recipientId, { title, body: n.message, url: n.link ?? "/" }).catch(() => {}),
    sendTelegramToUser(n.recipientId, `🔔 <b>${title}</b>\n${n.message}`).catch(() => {}),
  ]);
  return created;
}
