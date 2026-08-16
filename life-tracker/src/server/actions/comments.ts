"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { isNotificationEnabled } from "@/server/queries/notification-settings";
import { notify } from "@/server/notify";

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

  // сповіщаємо лише про згадки (@) — окремих сповіщень про звичайний коментар немає
  const mentionOn = await isNotificationEnabled("mention");
  const mentionSet = new Set<string>(mentionOn ? mentionIds : []);
  mentionSet.delete(user.id);

  await Promise.all(
    [...mentionSet].map((rid) =>
      notify({ recipientId: rid, type: "mention", message: `${user.name} згадав вас у коментарі до «${task.title}»`, link: `/tasks/${task.id}`, actorId: user.id }),
    ),
  );

  revalidatePath(`/tasks/${data.taskId}`);
  return { commentId: comment.id };
}
