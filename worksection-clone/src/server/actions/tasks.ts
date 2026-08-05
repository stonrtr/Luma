"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import type { TaskStatus } from "@/generated/prisma/enums";

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Введите название").max(200),
  status: z.enum(["TODO", "IN_PROGRESS", "TO_REVIEW", "DONE", "PAUSED"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  parentId: z.string().optional(),
});

export async function createTask(input: z.infer<typeof createTaskSchema>) {
  const user = await requireUser();
  const data = createTaskSchema.parse(input);

  const last = await db.task.findFirst({
    where: { projectId: data.projectId, status: data.status, parentId: data.parentId ?? null },
    orderBy: { position: "desc" },
  });

  const task = await db.task.create({
    data: {
      title: data.title,
      status: data.status,
      priority: data.priority,
      projectId: data.projectId,
      parentId: data.parentId ?? null,
      createdById: user.id,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      position: (last?.position ?? -1) + 1,
      assignees: data.assigneeId ? { create: [{ userId: data.assigneeId }] } : undefined,
    },
  });

  await db.activity.create({
    data: { type: "task.created", actorId: user.id, projectId: data.projectId, meta: task.title },
  });

  revalidatePath(`/projects/${data.projectId}`);
  if (data.parentId) revalidatePath(`/tasks/${data.parentId}`);
  return task;
}

// Перемещение задачи между колонками канбана / внутри колонки
export async function moveTask(input: {
  taskId: string;
  toStatus: TaskStatus;
  toIndex: number;
}) {
  await requireUser();
  const { taskId, toStatus, toIndex } = input;

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  const siblings = await db.task.findMany({
    where: { projectId: task.projectId, status: toStatus, parentId: null, archivedAt: null, id: { not: taskId } },
    orderBy: { position: "asc" },
  });

  const clampedIndex = Math.max(0, Math.min(toIndex, siblings.length));
  const ordered = [...siblings];
  ordered.splice(clampedIndex, 0, task);

  await db.$transaction([
    db.task.update({
      where: { id: taskId },
      data: {
        status: toStatus,
        completedAt: toStatus === "DONE" ? new Date() : null,
      },
    }),
    ...ordered.map((t, i) =>
      db.task.update({ where: { id: t.id }, data: { position: i } }),
    ),
  ]);

  revalidatePath(`/projects/${task.projectId}`);
}

const updateTaskSchema = z.object({
  taskId: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "TO_REVIEW", "DONE", "PAUSED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
  dueDate: z.string().nullable().optional(),
  estimateHrs: z.number().nullable().optional(),
});

export async function updateTask(input: z.infer<typeof updateTaskSchema>) {
  await requireUser();
  const data = updateTaskSchema.parse(input);
  const { taskId, dueDate, status, ...rest } = data;

  const task = await db.task.update({
    where: { id: taskId },
    data: {
      ...rest,
      ...(status ? { status, completedAt: status === "DONE" ? new Date() : null } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    },
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/projects/${task.projectId}`);
}

export async function setTaskAssignee(input: { taskId: string; userId: string | null }) {
  await requireUser();
  const task = await db.task.findUnique({ where: { id: input.taskId } });
  if (!task) return;
  await db.taskAssignee.deleteMany({ where: { taskId: input.taskId } });
  if (input.userId) {
    await db.taskAssignee.create({ data: { taskId: input.taskId, userId: input.userId } });
  }
  revalidatePath(`/tasks/${input.taskId}`);
  revalidatePath(`/projects/${task.projectId}`);
}

// --- Чек-листы ---
export async function addChecklistItem(input: { taskId: string; text: string }) {
  await requireUser();
  const text = input.text.trim();
  if (!text) return;
  const last = await db.checklistItem.findFirst({
    where: { taskId: input.taskId },
    orderBy: { position: "desc" },
  });
  await db.checklistItem.create({
    data: { taskId: input.taskId, text, position: (last?.position ?? -1) + 1 },
  });
  revalidatePath(`/tasks/${input.taskId}`);
}

export async function toggleChecklistItem(input: { id: string; done: boolean; taskId: string }) {
  await requireUser();
  await db.checklistItem.update({ where: { id: input.id }, data: { done: input.done } });
  revalidatePath(`/tasks/${input.taskId}`);
}

export async function deleteChecklistItem(input: { id: string; taskId: string }) {
  await requireUser();
  await db.checklistItem.delete({ where: { id: input.id } });
  revalidatePath(`/tasks/${input.taskId}`);
}

// --- Учёт времени ---
export async function logTime(input: { taskId: string; minutes: number; note?: string }) {
  const user = await requireUser();
  if (input.minutes <= 0) return;
  const task = await db.task.findUnique({ where: { id: input.taskId } });
  if (!task) return;
  await db.timeLog.create({
    data: { taskId: input.taskId, userId: user.id, minutes: input.minutes, note: input.note?.trim() || null },
  });
  revalidatePath(`/tasks/${input.taskId}`);
  revalidatePath(`/projects/${task.projectId}`);
}
