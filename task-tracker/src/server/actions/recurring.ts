"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireActionUser } from "@/server/dal";
import {
  createRecurringTaskSchema,
  deleteRecurringTaskSchema,
} from "@/server/validation/recurring";

export async function createRecurringTask(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireActionUser();

  const parsed = createRecurringTaskSchema.safeParse({
    assigneeId: formData.get("assigneeId"),
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority"),
    frequency: formData.get("frequency"),
    weekday: formData.get("weekday"),
    dayOfMonth: formData.get("dayOfMonth"),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Некорректные данные";
  }

  const { assigneeId, weekday, dayOfMonth, ...data } = parsed.data;

  await db.recurringTask.create({
    data: {
      ...data,
      weekday: weekday ?? null,
      dayOfMonth: dayOfMonth ?? null,
      assigneeId,
    },
  });

  revalidatePath(`/`);
  revalidatePath(`/team/${assigneeId}`);
}

export async function deleteRecurringTask(input: { id: string }) {
  await requireActionUser();
  const parsed = deleteRecurringTaskSchema.parse(input);

  const template = await db.recurringTask.delete({
    where: { id: parsed.id },
  });

  revalidatePath(`/`);
  revalidatePath(`/team/${template.assigneeId}`);
}
