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
  title: z.string().max(120).optional(),
  functions: z.string().max(1000).optional(),
  weeklyHours: z.number().min(0).max(168).nullable().optional(),
  managerId: z.string().nullable().optional(),
});

export async function updateOrgUser(input: z.infer<typeof schema>) {
  const viewer = await requireUser();
  const data = schema.parse(input);
  if (!(await canEdit(viewer.id, viewer.role, data.userId))) return { error: "Немає прав" };

  // менеджера может менять только админ/владелец
  const isAdmin = viewer.role === "OWNER" || viewer.role === "ADMIN";
  await db.user.update({
    where: { id: data.userId },
    data: {
      title: data.title,
      functions: data.functions,
      weeklyHours: data.weeklyHours ?? null,
      ...(isAdmin && data.managerId !== undefined ? { managerId: data.managerId } : {}),
    },
  });
  revalidatePath("/org");
  return { error: null };
}
