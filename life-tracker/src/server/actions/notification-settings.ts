"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { t } from "@/lib/i18n";

// Переключение одного канала (push | telegram) для типа уведомления.
export async function setNotificationSetting(input: { type: string; channel: "push" | "telegram"; enabled: boolean }) {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") return { error: t(user.locale, "err.noAccess") };
  const col = input.channel === "push" ? "pushEnabled" : "telegramEnabled";
  await db.notificationSetting.upsert({
    where: { type: input.type },
    update: { [col]: input.enabled },
    create: { type: input.type, pushEnabled: true, telegramEnabled: true, [col]: input.enabled },
  });
  revalidatePath("/settings");
  return { error: null };
}
