"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { id, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
