"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { syncTaskToGoogle } from "@/server/google/calendar";
import { getOrCreatePersonalProject } from "@/server/queries/life";

// Гарантирует, что переданный проект — личный проект-планер текущего пользователя.
async function requirePersonalProject(userId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, isPersonal: true, createdById: userId },
    select: { id: true },
  });
  if (!project) throw new Error("Немає доступу до особистого планера");
  return project.id;
}

const createTaskSchema = z.object({
  projectId: z.string(),
  sphereTagId: z.string(),
  title: z.string().min(1, "Введіть назву").max(200),
  priority: z.number().int().min(1).max(10).default(5),
  plannedMinutes: z.number().int().positive().nullable().optional(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
});

// Создать личную задачу в выбранной сфере (теге).
export async function createLifeTask(input: z.infer<typeof createTaskSchema>) {
  const user = await requireUser();
  const data = createTaskSchema.parse(input);
  const projectId = await requirePersonalProject(user.id, data.projectId);

  // тег-сфера должен принадлежать этому же личному проекту
  const sphere = await db.tag.findFirst({
    where: { id: data.sphereTagId, projectId },
    select: { id: true },
  });
  if (!sphere) throw new Error("Невідома сфера");

  const dueDate = data.dueDate ? new Date(data.dueDate) : null;
  const scheduledAt = data.dueDate && data.dueTime ? new Date(`${data.dueDate}T${data.dueTime}`) : null;

  const last = await db.task.findFirst({
    where: { projectId, status: "TODO", parentId: null },
    orderBy: { position: "desc" },
  });

  const task = await db.task.create({
    data: {
      title: data.title.trim(),
      status: "TODO",
      priority: data.priority,
      plannedMinutes: data.plannedMinutes ?? null,
      projectId,
      createdById: user.id,
      dueDate,
      scheduledAt,
      position: (last?.position ?? -1) + 1,
      assignees: { create: [{ userId: user.id }] },
      tags: { create: [{ tagId: sphere.id }] },
    },
  });

  await syncTaskToGoogle(task.id); // best-effort: событие-напоминание в Google Calendar
  revalidatePath("/life");
  return { id: task.id };
}

// Отметить выполнено / вернуть в работу.
export async function toggleLifeTaskDone(input: { taskId: string; done: boolean }) {
  const user = await requireUser();
  const task = await db.task.findUnique({
    where: { id: input.taskId },
    select: { id: true, projectId: true, project: { select: { isPersonal: true, createdById: true } } },
  });
  if (!task?.projectId || !task.project?.isPersonal || task.project.createdById !== user.id) return;

  await db.task.update({
    where: { id: input.taskId },
    data: {
      status: input.done ? "DONE" : "TODO",
      completedAt: input.done ? new Date() : null,
    },
  });
  await syncTaskToGoogle(input.taskId);
  revalidatePath("/life");
}

// Перенести задачу в другую сферу (одна сфера на задачу).
export async function moveLifeTaskToSphere(input: { taskId: string; sphereTagId: string }) {
  const user = await requireUser();
  const task = await db.task.findUnique({
    where: { id: input.taskId },
    select: { id: true, projectId: true, project: { select: { isPersonal: true, createdById: true } } },
  });
  if (!task?.projectId || !task.project?.isPersonal || task.project.createdById !== user.id) return;

  const projectId = task.projectId;
  const sphere = await db.tag.findFirst({ where: { id: input.sphereTagId, projectId }, select: { id: true } });
  if (!sphere) return;

  // снять все теги-сферы этого проекта и поставить один новый
  const projectTagIds = (await db.tag.findMany({ where: { projectId }, select: { id: true } })).map((t) => t.id);
  await db.$transaction([
    db.taskTag.deleteMany({ where: { taskId: input.taskId, tagId: { in: projectTagIds } } }),
    db.taskTag.create({ data: { taskId: input.taskId, tagId: sphere.id } }),
  ]);
  revalidatePath("/life");
}

// --- Управление сферами (тегами личного проекта) ---

export async function addSphere(input: { projectId: string; name: string; color?: string }) {
  const user = await requireUser();
  const projectId = await requirePersonalProject(user.id, input.projectId);
  const name = input.name.trim();
  if (!name) return { error: "Введіть назву" };
  await db.tag.upsert({
    where: { projectId_name: { projectId, name } },
    update: { color: input.color ?? "#64748b" },
    create: { projectId, name, color: input.color ?? "#64748b" },
  });
  revalidatePath("/life");
  return { error: null };
}

export async function renameSphere(input: { tagId: string; name: string; color?: string }) {
  const user = await requireUser();
  const name = input.name.trim();
  if (!name) return { error: "Введіть назву" };
  const tag = await db.tag.findUnique({
    where: { id: input.tagId },
    select: { id: true, project: { select: { isPersonal: true, createdById: true } } },
  });
  if (!tag?.project?.isPersonal || tag.project.createdById !== user.id) return { error: "Немає доступу" };
  await db.tag.update({ where: { id: input.tagId }, data: { name, ...(input.color ? { color: input.color } : {}) } });
  revalidatePath("/life");
  return { error: null };
}

// Удалить сферу. Задачи не удаляются — просто теряют сферу (переедут в «Без сферы»).
export async function deleteSphere(input: { tagId: string }) {
  const user = await requireUser();
  const tag = await db.tag.findUnique({
    where: { id: input.tagId },
    select: { id: true, project: { select: { isPersonal: true, createdById: true } } },
  });
  if (!tag?.project?.isPersonal || tag.project.createdById !== user.id) return;
  await db.tag.delete({ where: { id: input.tagId } });
  revalidatePath("/life");
}

// --- Повторяющиеся задачи (простые шаблоны) ---

const recurringSchema = z.object({
  projectId: z.string(),
  sphereTagId: z.string().optional(),
  title: z.string().min(1).max(200),
  priority: z.number().int().min(1).max(10).default(5),
  plannedMinutes: z.number().int().positive().nullable().optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("WEEKLY"),
  weekdays: z.string().optional(),   // csv 1..7 для WEEKLY
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
});

export async function createLifeRecurring(input: z.infer<typeof recurringSchema>) {
  const user = await requireUser();
  const data = recurringSchema.parse(input);
  const projectId = await requirePersonalProject(user.id, data.projectId);

  let tagId: string | null = null;
  if (data.sphereTagId) {
    const sphere = await db.tag.findFirst({ where: { id: data.sphereTagId, projectId }, select: { id: true } });
    tagId = sphere?.id ?? null;
  }

  await db.recurringTask.create({
    data: {
      title: data.title.trim(),
      priority: data.priority,
      plannedMinutes: data.plannedMinutes ?? null,
      frequency: data.frequency,
      weekdays: data.frequency === "WEEKLY" ? (data.weekdays || "1,2,3,4,5") : null,
      dayOfMonth: data.frequency === "MONTHLY" ? (data.dayOfMonth ?? 1) : null,
      projectId,
      tagId,
      assigneeId: user.id,
      createdById: user.id,
    },
  });
  revalidatePath("/life");
  return { error: null };
}

export async function deleteLifeRecurring(input: { id: string }) {
  const user = await requireUser();
  const r = await db.recurringTask.findUnique({ where: { id: input.id }, select: { assigneeId: true } });
  if (!r || r.assigneeId !== user.id) return;
  await db.recurringTask.delete({ where: { id: input.id } });
  revalidatePath("/life");
}
