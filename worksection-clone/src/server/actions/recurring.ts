"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { generateDueRecurringTasks } from "@/server/recurring-engine";

const schema = z.object({
  assigneeId: z.string(),
  title: z.string().min(1).max(200),
  priority: z.number().int().min(1).max(10).default(5),
  plannedMinutes: z.number().int().positive().nullable().optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("WEEKLY"),
  weekdays: z.string().optional(), // csv 1..7
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), // час старту екземплярів
  dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(), // щомісячні: число-дедлайн
  projectId: z.string().optional(),
});

async function canManage(viewerId: string, viewerRole: string, targetId: string) {
  if (viewerId === targetId) return true;
  if (viewerRole === "OWNER" || viewerRole === "ADMIN") return true;
  const t = await db.user.findUnique({ where: { id: targetId }, select: { managerId: true } });
  return t?.managerId === viewerId;
}

export async function createRecurringTask(input: z.infer<typeof schema>) {
  const viewer = await requireUser();
  const data = schema.parse(input);
  if (!(await canManage(viewer.id, viewer.role, data.assigneeId))) return { error: "Немає прав" };

  await db.recurringTask.create({
    data: {
      title: data.title.trim(),
      priority: data.priority,
      plannedMinutes: data.plannedMinutes ?? null,
      frequency: data.frequency,
      weekdays: data.frequency === "WEEKLY" ? (data.weekdays || "1,2,3,4,5") : null,
      dayOfMonth: data.frequency === "MONTHLY" ? (data.dayOfMonth ?? 1) : null,
      startTime: data.frequency === "MONTHLY" ? null : (data.startTime ?? null),
      dueDayOfMonth: data.frequency === "MONTHLY" ? (data.dueDayOfMonth ?? data.dayOfMonth ?? 1) : null,
      projectId: data.projectId || null,
      assigneeId: data.assigneeId,
      createdById: viewer.id,
    },
  });
  // Перший екземпляр — одразу, якщо сьогодні підходить під розклад
  // (інакше довелося б чекати планувальник, який ходить раз на 15 хв).
  await generateDueRecurringTasks().catch(() => 0);
  revalidatePath("/settings");
  revalidatePath("/");
  return { error: null };
}

export async function deleteRecurringTask(id: string) {
  const viewer = await requireUser();
  const r = await db.recurringTask.findUnique({ where: { id } });
  if (!r) return;
  if (!(await canManage(viewer.id, viewer.role, r.assigneeId))) return;
  // Вместе с шаблоном убираем все НЕ начатые экземпляры (статус «Зробити») —
  // включая сегодняшний и просроченные. Выполненные и взятые в работу остаются историей.
  await db.task.deleteMany({
    where: { recurringTaskId: id, status: "TODO" },
  });
  await db.recurringTask.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/");
}
