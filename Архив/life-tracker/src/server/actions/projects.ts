"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { isAdmin } from "@/server/authz";
import type { ProjectStatus } from "@/generated/prisma/enums";

// Управлять проектом (статус/удаление) может админ/владелец, создатель или менеджер проекта.
async function canManageProject(user: { id: string; role: string }, projectId: string): Promise<boolean> {
  if (isAdmin(user.role)) return true;
  const proj = await db.project.findUnique({ where: { id: projectId }, select: { createdById: true } });
  if (proj?.createdById === user.id) return true;
  const m = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } }, select: { role: true } });
  return m?.role === "MANAGER";
}

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

// Сменить статус проекта: Активний / На паузі / Завершений / В архіві
export async function setProjectStatus(projectId: string, status: ProjectStatus): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (!(await canManageProject(user, projectId))) return { error: "Немає прав" };
  await db.project.update({
    where: { id: projectId },
    data: { status, archivedAt: status === "ARCHIVED" ? new Date() : null },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

// Удалить проект. Задачи не удаляются — отвязываются (projectId → null, onDelete: SetNull).
export async function deleteProject(projectId: string): Promise<{ error: string } | void> {
  const user = await requireUser();
  if (!(await canManageProject(user, projectId))) return { error: "Немає прав" };
  await db.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
  redirect("/projects");
}
