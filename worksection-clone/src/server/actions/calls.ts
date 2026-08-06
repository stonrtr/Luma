"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

const schema = z.object({
  title: z.string().min(1).max(200),
  date: z.string(),
  time: z.string(),
  durationMin: z.number().int().positive().default(30),
  userId: z.string().optional(), // кому (по умолчанию — себе)
});

export async function createCall(input: z.infer<typeof schema>) {
  const viewer = await requireUser();
  const data = schema.parse(input);
  const scheduledAt = new Date(`${data.date}T${data.time}`);
  if (isNaN(scheduledAt.getTime())) return { error: "Невірна дата/час" };

  const userId = data.userId || viewer.id;
  // назначать звонки другим может только админ/владелец или руководитель
  if (userId !== viewer.id && viewer.role !== "OWNER" && viewer.role !== "ADMIN") {
    const target = await db.user.findUnique({ where: { id: userId }, select: { managerId: true } });
    if (target?.managerId !== viewer.id) return { error: "Немає прав" };
  }

  await db.call.create({ data: { title: data.title.trim(), scheduledAt, durationMin: data.durationMin, userId } });
  revalidatePath("/calendar");
  return { error: null };
}

export async function deleteCall(id: string) {
  const viewer = await requireUser();
  const call = await db.call.findUnique({ where: { id } });
  if (!call) return;
  if (call.userId !== viewer.id && viewer.role !== "OWNER" && viewer.role !== "ADMIN") return;
  await db.call.delete({ where: { id } });
  revalidatePath("/calendar");
}
