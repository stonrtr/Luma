import "server-only";
import { db } from "@/server/db";

export async function getNotificationSettings(): Promise<Record<string, boolean>> {
  const rows = await db.notificationSetting.findMany();
  const map: Record<string, boolean> = {};
  for (const r of rows) map[r.type] = r.enabled;
  return map;
}

// по умолчанию включено, пока админ не выключил
export async function isNotificationEnabled(type: string): Promise<boolean> {
  const row = await db.notificationSetting.findUnique({ where: { type } });
  return row ? row.enabled : true;
}
