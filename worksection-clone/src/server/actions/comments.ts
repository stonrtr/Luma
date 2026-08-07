"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { isNotificationEnabled } from "@/server/queries/notification-settings";

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
    data: { type: "comment.added", actorId: user.id, projectId: task.projectId, taskId: task.id, meta: task.title },
  });

  // упоминания имеют приоритет; обычный коммент — исполнителям и автору задачи
  const [mentionOn, commentOn] = await Promise.all([
    isNotificationEnabled("mention"),
    isNotificationEnabled("comment"),
  ]);
  const mentionSet = new Set<string>(mentionOn ? mentionIds : []);

  const commentSet = new Set<string>();
  if (commentOn) {
    const assignees = await db.taskAssignee.findMany({ where: { taskId: data.taskId }, select: { userId: true } });
    for (const a of assignees) if (a.userId !== user.id) commentSet.add(a.userId);
    if (task.createdById !== user.id) commentSet.add(task.createdById);
    for (const id of mentionSet) commentSet.delete(id); // не дублируем с упоминанием
  }

  await Promise.all([
    ...[...mentionSet].map((rid) =>
      db.notification.create({
        data: { type: "mention", message: `${user.name} згадав вас у коментарі до «${task.title}»`, link: `/tasks/${task.id}`, recipientId: rid, actorId: user.id },
      }),
    ),
    ...[...commentSet].map((rid) =>
      db.notification.create({
        data: { type: "comment", message: `${user.name} прокоментував «${task.title}»`, link: `/tasks/${task.id}`, recipientId: rid, actorId: user.id },
      }),
    ),
  ]);

  revalidatePath(`/tasks/${data.taskId}`);
  return { commentId: comment.id };
}
