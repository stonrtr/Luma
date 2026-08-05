"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

const schema = z.object({
  taskId: z.string(),
  body: z.string().min(1, "Комментарий пуст").max(5000),
});

export async function addComment(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const data = schema.parse(input);

  const task = await db.task.findUnique({ where: { id: data.taskId } });
  if (!task) return;

  await db.comment.create({
    data: { taskId: data.taskId, authorId: user.id, body: data.body.trim() },
  });

  await db.activity.create({
    data: { type: "comment.added", actorId: user.id, projectId: task.projectId, meta: task.title },
  });

  // уведомить исполнителей задачи (кроме автора)
  const assignees = await db.taskAssignee.findMany({ where: { taskId: data.taskId } });
  await Promise.all(
    assignees
      .filter((a) => a.userId !== user.id)
      .map((a) =>
        db.notification.create({
          data: {
            type: "comment",
            message: `${user.name} прокомментировал(а) «${task.title}»`,
            link: `/tasks/${task.id}`,
            recipientId: a.userId,
            actorId: user.id,
          },
        }),
      ),
  );

  revalidatePath(`/tasks/${data.taskId}`);
}
