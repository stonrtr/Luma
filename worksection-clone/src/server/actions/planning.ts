"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { mondayOf } from "@/lib/week";

// может ли viewer управлять целями/KPI пользователя target
async function canManage(viewerId: string, viewerRole: string, targetId: string) {
  if (viewerRole === "OWNER" || viewerRole === "ADMIN") return true;
  if (viewerId === targetId) return false; // цели/KPI ставит руководитель, не сам
  const t = await db.user.findUnique({ where: { id: targetId }, select: { managerId: true } });
  return t?.managerId === viewerId;
}

// --- Цели месяца (ставит руководитель) ---
export async function addGoal(input: { userId: string; text: string; year: number; month: number }) {
  const viewer = await requireUser();
  if (!(await canManage(viewer.id, viewer.role, input.userId))) return { error: "Немає прав" };
  const text = input.text.trim();
  if (!text) return { error: "Порожня ціль" };
  await db.monthlyGoal.create({ data: { userId: input.userId, text, year: input.year, month: input.month } });
  revalidatePath("/planning");
  return { error: null };
}

export async function deleteGoal(id: string) {
  const viewer = await requireUser();
  const goal = await db.monthlyGoal.findUnique({ where: { id } });
  if (!goal) return;
  if (!(await canManage(viewer.id, viewer.role, goal.userId))) return;
  await db.monthlyGoal.delete({ where: { id } });
  revalidatePath("/planning");
}

// --- KPI ---
export async function addKpi(input: { userId: string; title: string; target: string; year: number; month: number }) {
  const viewer = await requireUser();
  if (!(await canManage(viewer.id, viewer.role, input.userId))) return { error: "Немає прав" };
  const title = input.title.trim();
  if (!title) return { error: "Порожній KPI" };
  await db.kpi.create({
    data: { userId: input.userId, title, target: input.target.trim() || null, year: input.year, month: input.month },
  });
  revalidatePath("/planning");
  return { error: null };
}

// Редактирование цели KPI после создания (руководитель)
export async function updateKpiTarget(input: { id: string; title?: string; target: string }) {
  const viewer = await requireUser();
  const kpi = await db.kpi.findUnique({ where: { id: input.id } });
  if (!kpi) return { error: "Не знайдено" };
  if (!(await canManage(viewer.id, viewer.role, kpi.userId))) return { error: "Немає прав" };
  await db.kpi.update({
    where: { id: input.id },
    data: {
      target: input.target.trim() || null,
      ...(input.title != null && input.title.trim() ? { title: input.title.trim() } : {}),
    },
  });
  revalidatePath("/planning");
  revalidatePath("/");
  return { error: null };
}

export async function deleteKpi(id: string) {
  const viewer = await requireUser();
  const kpi = await db.kpi.findUnique({ where: { id } });
  if (!kpi) return;
  if (!(await canManage(viewer.id, viewer.role, kpi.userId))) return;
  await db.kpi.delete({ where: { id } });
  revalidatePath("/planning");
}

// Сотрудник вносит факт и отмечает достигнуто/не достигнуто
export async function updateKpiResult(input: { id: string; actualValue: string; achieved: boolean | null }) {
  const viewer = await requireUser();
  const kpi = await db.kpi.findUnique({ where: { id: input.id } });
  if (!kpi) return;
  const allowed = kpi.userId === viewer.id || (await canManage(viewer.id, viewer.role, kpi.userId));
  if (!allowed) return;
  await db.kpi.update({
    where: { id: input.id },
    data: { actualValue: input.actualValue.trim() || null, achieved: input.achieved },
  });
  revalidatePath("/planning");
}

// --- Недельный план ---
const planItemSchema = z.object({
  userId: z.string(),
  weekStart: z.string(),
  title: z.string().min(1).max(200),
  priority: z.number().int().min(1).max(10).default(5),
  projectId: z.string().optional(),
});

export async function addPlanItem(input: z.infer<typeof planItemSchema>) {
  const viewer = await requireUser();
  const data = planItemSchema.parse(input);
  // план ведёт сам сотрудник или его руководитель
  const canEdit = data.userId === viewer.id || (await canManage(viewer.id, viewer.role, data.userId));
  if (!canEdit) return { error: "Немає прав" };

  const ws = mondayOf(new Date(data.weekStart));
  const count = await db.weeklyPlanItem.count({ where: { userId: data.userId, weekStart: ws } });
  await db.weeklyPlanItem.create({
    data: {
      userId: data.userId, weekStart: ws, title: data.title.trim(),
      priority: data.priority, order: count, projectId: data.projectId || null,
    },
  });
  revalidatePath("/planning");
  return { error: null };
}

export async function deletePlanItem(id: string) {
  const viewer = await requireUser();
  const item = await db.weeklyPlanItem.findUnique({ where: { id } });
  if (!item) return;
  const canEdit = item.userId === viewer.id || (await canManage(viewer.id, viewer.role, item.userId));
  if (!canEdit) return;
  await db.weeklyPlanItem.delete({ where: { id } });
  revalidatePath("/planning");
}

// Утверждение плана → создаём задачи в канбане и связываем
export async function approvePlan(input: { userId: string; weekStart: string }) {
  const viewer = await requireUser();
  const canEdit = input.userId === viewer.id || (await canManage(viewer.id, viewer.role, input.userId));
  if (!canEdit) return;

  const ws = mondayOf(new Date(input.weekStart));
  const items = await db.weeklyPlanItem.findMany({
    where: { userId: input.userId, weekStart: ws, approved: false, taskId: null },
  });

  for (const item of items) {
    const last = await db.task.findFirst({
      where: { projectId: item.projectId ?? null, status: "TODO", parentId: null },
      orderBy: { position: "desc" },
    });
    const task = await db.task.create({
      data: {
        title: item.title,
        status: "TODO",
        priority: item.priority,
        projectId: item.projectId ?? null,
        createdById: viewer.id,
        assignedByManager: viewer.id !== input.userId,
        dueDate: new Date(ws.getTime() + 6 * 86400000),
        position: (last?.position ?? -1) + 1,
        assignees: { create: [{ userId: input.userId }] },
      },
    });
    await db.weeklyPlanItem.update({ where: { id: item.id }, data: { approved: true, taskId: task.id } });

    if (viewer.id !== input.userId) {
      await db.notification.create({
        data: {
          type: "assignment",
          message: `${viewer.name} додав задачу з плану «${task.title}»`,
          link: `/tasks/${task.id}`,
          recipientId: input.userId,
          actorId: viewer.id,
        },
      });
    }
  }

  revalidatePath("/planning");
}
