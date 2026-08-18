"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireActionUser } from "@/server/dal";
import { createCommentSchema } from "@/server/validation/comment";

export async function addComment(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const user = await requireActionUser();

  const parsed = createCommentSchema.safeParse({
    taskId: formData.get("taskId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Некорректные данные";
  }

  const task = await db.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true },
  });
  if (!task) return "Задача не найдена";

  await db.comment.create({
    data: {
      taskId: parsed.data.taskId,
      body: parsed.data.body,
      authorId: user.id,
    },
  });

  revalidatePath(`/tasks/${parsed.data.taskId}`);
}
