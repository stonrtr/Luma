"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { t } from "@/lib/i18n";
import { notificationMeta } from "@/lib/notification-types";

type Patch = {
  enabled?: boolean;
  push?: boolean;
  telegram?: boolean;
  sendAtMinutes?: number | null;
  weekdaysOnly?: boolean;
};

// Обновление конфига типа уведомления (частичное). Только для OWNER/ADMIN.
export async function updateNotificationSetting(input: { type: string } & Patch) {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") return { error: t(user.locale, "err.noAccess") };
  const meta = notificationMeta(input.type);
  if (!meta) return { error: "unknown type" };

  const patch: Record<string, unknown> = {};
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.push !== undefined) patch.pushEnabled = input.push;
  if (input.telegram !== undefined) patch.telegramEnabled = input.telegram;
  if (input.sendAtMinutes !== undefined) patch.sendAtMinutes = input.sendAtMinutes;
  if (input.weekdaysOnly !== undefined) patch.weekdaysOnly = input.weekdaysOnly;

  await db.notificationSetting.upsert({
    where: { type: input.type },
    update: patch,
    create: {
      type: input.type,
      enabled: true, pushEnabled: true, telegramEnabled: true,
      sendAtMinutes: meta.defaultAt ?? null, weekdaysOnly: true,
      ...patch,
    },
  });
  revalidatePath("/admin/notifications");
  revalidatePath("/settings");
  return { error: null };
}
