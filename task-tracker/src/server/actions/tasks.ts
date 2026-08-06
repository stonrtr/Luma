"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireActionUser } from "@/server/dal";
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  bulkCloseSchema,
} from "@/server/validation/task";
import { TaskStatus } from "@/generated/prisma/client";

export async function createTask(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const user = await requireActionUser();

  const parsed = createTaskSchema.safeParse({
    assigneeId: formData.get("assigneeId"),
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status") || undefined,
    priority: formData.get("priority") || undefined,
    dueDate: formData.get("dueDate"),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Некорректные данные";
  }

  const { assigneeId, status, ...data } = parsed.data;

  const maxPosition = await db.task.aggregate({
    where: { assigneeId, status },
    _max: { position: true },
  });

  await db.task.create({
    data: {
      ...data,
      status,
      completedAt: status === TaskStatus.DONE ? new Date() : null,
      position: (maxPosition._max.position ?? -1) + 1,
      assigneeId,
      createdById: user.id,
    },
  });

  revalidatePath(`/`);
  revalidatePath(`/team/${assigneeId}`);
}

export async function updateTask(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireActionUser();

  const parsed = updateTaskSchema.safeParse({
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate"),
    assigneeId: formData.get("assigneeId"),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Некорректные данные";
  }

  const { taskId, ...data } = parsed.data;

  const previous = await db.task.findUnique({
    where: { id: taskId },
    select: { assigneeId: true, status: true },
  });

  const becameDone =
    data.status === TaskStatus.DONE && previous?.status !== TaskStatus.DONE;
  const leftDone =
    data.status !== TaskStatus.DONE && previous?.status === TaskStatus.DONE;

  const task = await db.task.update({
    where: { id: taskId },
    data: {
      ...data,
      ...(becameDone && { completedAt: new Date() }),
      ...(leftDone && { completedAt: null }),
    },
  });

  revalidatePath(`/`);
  revalidatePath(`/team/${task.assigneeId}`);
  revalidatePath(`/tasks/${task.id}`);
  if (previous && previous.assigneeId !== task.assigneeId) {
    revalidatePath(`/team/${previous.assigneeId}`);
  }
}

export async function moveTask(input: {
  taskId: string;
  toStatus: TaskStatus;
  orderedTaskIds: string[];
}) {
  await requireActionUser();

  const parsed = moveTaskSchema.parse(input);

  const task = await db.task.findUnique({
    where: { id: parsed.taskId },
    select: { assigneeId: true, status: true },
  });
  if (!task) throw new Error("Task not found");

  const becameDone =
    parsed.toStatus === TaskStatus.DONE && task.status !== TaskStatus.DONE;
  const leftDone =
    parsed.toStatus !== TaskStatus.DONE && task.status === TaskStatus.DONE;

  await db.$transaction(
    parsed.orderedTaskIds.map((id, index) =>
      db.task.update({
        where: { id },
        data: {
          position: index,
          ...(id === parsed.taskId && { status: parsed.toStatus }),
          ...(id === parsed.taskId && becameDone && { completedAt: new Date() }),
          ...(id === parsed.taskId && leftDone && { completedAt: null }),
        },
      }),
    ),
  );

  revalidatePath(`/`);
  revalidatePath(`/team/${task.assigneeId}`);
}

export async function bulkMoveTasks(input: {
  taskIds: string[];
  toStatus: TaskStatus;
}) {
  await requireActionUser();

  const { taskIds, toStatus } = input;
  if (taskIds.length === 0) return;

  const moving = await db.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, assigneeId: true, status: true },
  });
  if (moving.length === 0) return;

  const assigneeId = moving[0].assigneeId;

  const existing = await db.task.findMany({
    where: {
      assigneeId,
      status: toStatus,
      id: { notIn: taskIds },
    },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const finalOrder = [...existing.map((t) => t.id), ...taskIds];

  await db.$transaction(
    finalOrder.map((id, index) => {
      const beingMoved = taskIds.includes(id);
      const wasDone = moving.find((t) => t.id === id)?.status === TaskStatus.DONE;
      const becameDone = beingMoved && toStatus === TaskStatus.DONE && !wasDone;
      const leftDone = beingMoved && toStatus !== TaskStatus.DONE && wasDone;
      return db.task.update({
        where: { id },
        data: {
          position: index,
          ...(beingMoved && { status: toStatus }),
          ...(becameDone && { completedAt: new Date() }),
          ...(leftDone && { completedAt: null }),
        },
      });
    }),
  );

  revalidatePath(`/`);
  revalidatePath(`/team/${assigneeId}`);
}

export async function setTaskPriority(input: { id: string; priority: number }) {
  await requireActionUser();

  const priority = Math.min(10, Math.max(1, Math.round(input.priority)));
  const task = await db.task.update({
    where: { id: input.id },
    data: { priority },
  });

  revalidatePath(`/`);
  revalidatePath(`/team/${task.assigneeId}`);
  revalidatePath(`/tasks/${task.id}`);
}

export async function restoreTask(input: { id: string }) {
  await requireActionUser();

  const task = await db.task.update({
    where: { id: input.id },
    data: { archivedAt: null },
  });

  revalidatePath(`/`);
  revalidatePath(`/team/${task.assigneeId}`);
}

export async function bulkCloseTasks(input: { taskIds: string[] }) {
  await requireActionUser();

  const parsed = bulkCloseSchema.parse(input);

  const tasks = await db.task.findMany({
    where: { id: { in: parsed.taskIds } },
    select: { assigneeId: true },
  });

  await db.task.updateMany({
    where: { id: { in: parsed.taskIds } },
    data: { status: TaskStatus.DONE, completedAt: new Date() },
  });

  revalidatePath(`/`);
  for (const assigneeId of new Set(tasks.map((t) => t.assigneeId))) {
    revalidatePath(`/team/${assigneeId}`);
  }
}
