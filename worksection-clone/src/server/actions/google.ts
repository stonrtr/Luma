"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

export async function disconnectGoogle() {
  const user = await requireUser();
  await db.googleAccount.deleteMany({ where: { userId: user.id } });
  // связи задач с событиями больше не актуальны
  await db.task.updateMany({ where: { assignees: { some: { userId: user.id } }, googleEventId: { not: null } }, data: { googleEventId: null } });
  revalidatePath("/settings");
}
