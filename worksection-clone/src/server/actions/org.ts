"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

async function canEdit(viewerId: string, viewerRole: string, targetId: string) {
  if (viewerRole === "OWNER" || viewerRole === "ADMIN") return true;
  const t = await db.user.findUnique({ where: { id: targetId }, select: { managerId: true } });
  return t?.managerId === viewerId;
}

const schema = z.object({
  userId: z.string(),
  name: z.string().min(1).max(80).optional(),
  title: z.string().max(120).optional(),
  functions: z.string().max(1000).optional(),
  weeklyHours: z.number().min(0).max(168).nullable().optional(),
  driveFolderUrl: z.string().max(500).nullable().optional(),
  managerId: z.string().nullable().optional(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  isActive: z.boolean().optional(),
});

export async function updateOrgUser(input: z.infer<typeof schema>) {
  const viewer = await requireUser();
  const data = schema.parse(input);
  if (!(await canEdit(viewer.id, viewer.role, data.userId))) return { error: "Немає прав" };

  const isAdmin = viewer.role === "OWNER" || viewer.role === "ADMIN";
  const target = await db.user.findUnique({ where: { id: data.userId }, select: { role: true } });
  if (!target) return { error: "Користувача не знайдено" };

  // роль/активность/менеджер меняет только админ; владельца и себя не трогаем
  const canChangeAccess = isAdmin && target.role !== "OWNER" && data.userId !== viewer.id;

  await db.user.update({
    where: { id: data.userId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      title: data.title,
      functions: data.functions,
      weeklyHours: data.weeklyHours ?? null,
      ...(data.driveFolderUrl !== undefined ? { driveFolderUrl: data.driveFolderUrl || null } : {}),
      ...(isAdmin && data.managerId !== undefined ? { managerId: data.managerId } : {}),
      ...(canChangeAccess && data.role !== undefined ? { role: data.role } : {}),
      ...(canChangeAccess && data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
  revalidatePath("/org");
  revalidatePath("/admin/users");
  return { error: null };
}
