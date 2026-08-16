"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

const addSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  role: z.enum(["MANAGER", "MEMBER", "CLIENT"]).default("MEMBER"),
});

export async function addProjectMember(input: z.infer<typeof addSchema>) {
  await requireUser();
  const data = addSchema.parse(input);
  await db.projectMember.upsert({
    where: { projectId_userId: { projectId: data.projectId, userId: data.userId } },
    update: { role: data.role },
    create: data,
  });
  revalidatePath(`/projects/${data.projectId}`);
}

export async function removeProjectMember(input: { projectId: string; userId: string }) {
  const user = await requireUser();
  // нельзя удалить самого себя (упрощение)
  if (input.userId === user.id) return;
  await db.projectMember.deleteMany({
    where: { projectId: input.projectId, userId: input.userId },
  });
  revalidatePath(`/projects/${input.projectId}`);
}
