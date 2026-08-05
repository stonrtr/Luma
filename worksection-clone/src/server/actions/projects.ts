"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

const schema = z.object({
  name: z.string().min(1, "Введите название").max(120),
  description: z.string().max(2000).optional(),
  color: z.string().default("#4f46e5"),
});

export async function createProject(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const data = schema.parse(input);

  const project = await db.project.create({
    data: {
      name: data.name,
      description: data.description || null,
      color: data.color,
      createdById: user.id,
      members: { create: [{ userId: user.id, role: "MANAGER" }] },
    },
  });

  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}
