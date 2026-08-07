"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { notify } from "@/server/notify";
import { canManageUser } from "@/server/authz";
import { mondayOf } from "@/lib/week";

// тонкая обёртка над общим слоем прав (совместимость с вызовами ниже)
async function canManage(viewerId: string, viewerRole: string, targetId: string) {
  return canManageUser({ id: viewerId, role: viewerRole }, targetId);
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

// Добавить в план уже существующую задачу (без создания новой)
const fromTaskSchema = z.object({ userId: z.string(), weekStart: z.string(), taskId: z.string() });
export async function addExistingTaskToPlan(input: z.infer<typeof fromTaskSchema>) {
  const viewer = await requireUser();
  const data = fromTaskSchema.parse(input);
  const canEdit = data.userId === viewer.id || (await canManage(viewer.id, viewer.role, data.userId));
  if (!canEdit) return { error: "Немає прав" };

  const task = await db.task.findUnique({ where: { id: data.taskId }, select: { id: true, title: true, priority: true, projectId: true } });
  if (!task) return { error: "Задачу не знайдено" };

  const ws = mondayOf(new Date(data.weekStart));
  const dup = await db.weeklyPlanItem.findFirst({ where: { userId: data.userId, weekStart: ws, taskId: task.id } });
  if (dup) return { error: "Задача вже в плані" };

  const count = await db.weeklyPlanItem.count({ where: { userId: data.userId, weekStart: ws } });
  await db.weeklyPlanItem.create({
    data: {
      userId: data.userId, weekStart: ws, title: task.title,
      priority: task.priority, order: count, projectId: task.projectId,
      approved: true, taskId: task.id,
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
// у кого нет руководителя (владелец/сам себе) — может утверждать свой план сам
async function canApprove(viewer: { id: string; role: string }, targetId: string) {
  if (await canManage(viewer.id, viewer.role, targetId)) return true;
  if (viewer.id === targetId) {
    const t = await db.user.findUnique({ where: { id: targetId }, select: { managerId: true } });
    return !t?.managerId; // нет руководителя — утверждает сам
  }
  return false;
}

export async function approvePlan(input: { userId: string; weekStart: string }) {
  const viewer = await requireUser();
  if (!(await canApprove(viewer, input.userId))) return { error: "Тільки керівник може затвердити" };

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
  }

  await db.weeklyPlanApproval.upsert({
    where: { userId_weekStart: { userId: input.userId, weekStart: ws } },
    create: { userId: input.userId, weekStart: ws, status: "APPROVED", reviewerId: viewer.id, decidedAt: new Date() },
    update: { status: "APPROVED", reviewerId: viewer.id, decidedAt: new Date(), comment: null },
  });

  if (viewer.id !== input.userId) {
    await notify({ recipientId: input.userId, type: "assignment", message: `${viewer.name} затвердив ваш план тижня`, link: "/planning", actorId: viewer.id });
  }
  revalidatePath("/planning");
  return { error: null };
}

// Сотрудник отправляет план руководителю на утверждение
export async function submitPlanForApproval(input: { weekStart: string }) {
  const viewer = await requireUser();
  const ws = mondayOf(new Date(input.weekStart));
  const count = await db.weeklyPlanItem.count({ where: { userId: viewer.id, weekStart: ws } });
  if (count === 0) return { error: "Додайте хоча б одну задачу" };

  await db.weeklyPlanApproval.upsert({
    where: { userId_weekStart: { userId: viewer.id, weekStart: ws } },
    create: { userId: viewer.id, weekStart: ws, status: "PENDING", submittedAt: new Date() },
    update: { status: "PENDING", submittedAt: new Date(), comment: null },
  });

  // уведомляем руководителя (или всех админов/владельцев)
  const me = await db.user.findUnique({ where: { id: viewer.id }, select: { managerId: true, name: true } });
  const managerIds = new Set<string>();
  if (me?.managerId) managerIds.add(me.managerId);
  else {
    const admins = await db.user.findMany({ where: { role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
    for (const a of admins) managerIds.add(a.id);
  }
  managerIds.delete(viewer.id);
  await Promise.all([...managerIds].map((rid) =>
    notify({ recipientId: rid, type: "review", message: `${viewer.name} надіслав план тижня на затвердження`, link: `/planning?user=${viewer.id}`, actorId: viewer.id }),
  ));

  revalidatePath("/planning");
  return { error: null };
}

// Руководитель возвращает план на доработку
export async function returnPlan(input: { userId: string; weekStart: string; comment?: string }) {
  const viewer = await requireUser();
  if (!(await canManage(viewer.id, viewer.role, input.userId))) return { error: "Немає прав" };
  const ws = mondayOf(new Date(input.weekStart));

  await db.weeklyPlanApproval.upsert({
    where: { userId_weekStart: { userId: input.userId, weekStart: ws } },
    create: { userId: input.userId, weekStart: ws, status: "RETURNED", reviewerId: viewer.id, decidedAt: new Date(), comment: input.comment?.trim() || null },
    update: { status: "RETURNED", reviewerId: viewer.id, decidedAt: new Date(), comment: input.comment?.trim() || null },
  });

  await notify({ recipientId: input.userId, type: "review", message: `${viewer.name} повернув план тижня на доопрацювання`, link: "/planning", actorId: viewer.id });
  revalidatePath("/planning");
  return { error: null };
}
