import "server-only";
import { db } from "@/server/db";

export type NotifChannels = { push: boolean; telegram: boolean };

// Настройки по типам: два канала — пуш в приложении и Telegram. По умолчанию оба включены.
export async function getNotificationSettings(): Promise<Record<string, NotifChannels>> {
  const rows = await db.notificationSetting.findMany();
  const map: Record<string, NotifChannels> = {};
  for (const r of rows) map[r.type] = { push: r.pushEnabled, telegram: r.telegramEnabled };
  return map;
}

// Каналы доставки для типа (по умолчанию оба включены, пока админ не выключил).
export async function getNotificationChannels(type: string): Promise<NotifChannels> {
  const row = await db.notificationSetting.findUnique({ where: { type } });
  return row ? { push: row.pushEnabled, telegram: row.telegramEnabled } : { push: true, telegram: true };
}

// Тип «активен», если включён хотя бы один канал — иначе уведомление не создаём вовсе.
export async function isNotificationEnabled(type: string): Promise<boolean> {
  const c = await getNotificationChannels(type);
  return c.push || c.telegram;
}
