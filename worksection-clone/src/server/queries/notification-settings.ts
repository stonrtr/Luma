import "server-only";
import { db } from "@/server/db";
import { notificationMeta } from "@/lib/notification-types";

export type NotifConfig = {
  enabled: boolean;      // мастер вкл/выкл
  push: boolean;         // пуш в приложении + колокол
  telegram: boolean;     // Telegram-бот
  sendAtMinutes: number | null; // время суток (мин от полуночи, Киев) — для плановых
  weekdaysOnly: boolean; // только Пн–Пт
};
export type NotifChannels = { push: boolean; telegram: boolean };

// Полный конфиг типа (с дефолтами из метаданных, пока админ не сохранил своё).
export async function getNotificationConfig(type: string): Promise<NotifConfig> {
  const row = await db.notificationSetting.findUnique({ where: { type } });
  const meta = notificationMeta(type);
  return {
    enabled: row?.enabled ?? true,
    push: row?.pushEnabled ?? true,
    telegram: row?.telegramEnabled ?? true,
    sendAtMinutes: row?.sendAtMinutes ?? meta?.defaultAt ?? null,
    weekdaysOnly: row?.weekdaysOnly ?? true,
  };
}

// Все конфиги (для админ-хаба).
export async function getNotificationSettings(): Promise<Record<string, NotifConfig>> {
  const rows = await db.notificationSetting.findMany();
  const byType = new Map(rows.map((r) => [r.type, r]));
  const map: Record<string, NotifConfig> = {};
  for (const meta of (await import("@/lib/notification-types")).NOTIFICATION_TYPES) {
    const row = byType.get(meta.key);
    map[meta.key] = {
      enabled: row?.enabled ?? true,
      push: row?.pushEnabled ?? true,
      telegram: row?.telegramEnabled ?? true,
      sendAtMinutes: row?.sendAtMinutes ?? meta.defaultAt ?? null,
      weekdaysOnly: row?.weekdaysOnly ?? true,
    };
  }
  return map;
}

// Каналы доставки типа (учитывают мастер enabled: выключен — оба канала off).
export async function getNotificationChannels(type: string): Promise<NotifChannels> {
  const c = await getNotificationConfig(type);
  return { push: c.enabled && c.push, telegram: c.enabled && c.telegram };
}

// Тип «активен», если включён и есть хотя бы один канал.
export async function isNotificationEnabled(type: string): Promise<boolean> {
  const c = await getNotificationConfig(type);
  return c.enabled && (c.push || c.telegram);
}
