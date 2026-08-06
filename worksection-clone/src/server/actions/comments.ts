"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

const schema = z.object({
  taskId: z.string(),
  body: z.string().min(1, "Коментар порожній").max(5000),
  mentions: z.array(z.string()).optional(),
});

export async function addComment(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const data = schema.parse(input);

  const task = await db.task.findUnique({ where: { id: data.taskId } });
  if (!task) return;

  const mentionIds = [...new Set(data.mentions ?? [])].filter((id) => id !== user.id);

  const comment = await db.comment.create({
    data: {
      taskId: data.taskId,
      authorId: user.id,
      body: data.body.trim(),
      mentions: mentionIds.length ? { create: mentionIds.map((userId) => ({ userId })) } : undefined,
    },
  });

  await db.activity.create({
    data: { type: "comment.added", actorId: user.id, projectId: task.projectId, meta: task.title },
  });

  // кого уведомить: упомянутые + исполнители (без дублей и без автора)
  const assignees = await db.taskAssignee.findMany({ where: { taskId: data.taskId }, select: { userId: true } });
  const recipients = new Set<string>();
  for (const id of mentionIds) recipients.add(id);
  for (const a of assignees) if (a.userId !== user.id) recipients.add(a.userId);

  await Promise.all(
    [...recipients].map((rid) =>
      db.notification.create({
        data: {
          type: mentionIds.includes(rid) ? "mention" : "comment",
          message: mentionIds.includes(rid)
            ? `${user.name} згадав вас у коментарі до «${task.title}»`
            : `${user.name} прокоментував «${task.title}»`,
          link: `/tasks/${task.id}`,
          recipientId: rid,
          actorId: user.id,
        },
      }),
    ),
  );

  revalidatePath(`/tasks/${data.taskId}`);
  return { commentId: comment.id };
}
