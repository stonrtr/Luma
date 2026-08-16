"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

const createSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(40),
  color: z.string().default("#64748b"),
});

export async function createTag(input: z.infer<typeof createSchema>) {
  await requireUser();
  const data = createSchema.parse(input);
  const tag = await db.tag.upsert({
    where: { projectId_name: { projectId: data.projectId, name: data.name } },
    update: { color: data.color },
    create: data,
  });
  revalidatePath(`/projects/${data.projectId}`);
  return tag;
}

export async function toggleTaskTag(input: { taskId: string; tagId: string; on: boolean }) {
  await requireUser();
  const task = await db.task.findUnique({ where: { id: input.taskId } });
  if (!task) return;
  if (input.on) {
    await db.taskTag.upsert({
      where: { taskId_tagId: { taskId: input.taskId, tagId: input.tagId } },
      update: {},
      create: { taskId: input.taskId, tagId: input.tagId },
    });
  } else {
    await db.taskTag.deleteMany({ where: { taskId: input.taskId, tagId: input.tagId } });
  }
  revalidatePath(`/tasks/${input.taskId}`);
  revalidatePath(`/projects/${task.projectId}`);
}
