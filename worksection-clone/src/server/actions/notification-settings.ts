"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

export async function setNotificationSetting(input: { type: string; enabled: boolean }) {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") return { error: "Немає прав" };
  await db.notificationSetting.upsert({
    where: { type: input.type },
    update: { enabled: input.enabled },
    create: { type: input.type, enabled: input.enabled },
  });
  revalidatePath("/admin/notifications");
  return { error: null };
}
