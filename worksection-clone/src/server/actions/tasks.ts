"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { zonedTimeToUtc, zonedDateStr } from "@/lib/tz";
import { t } from "@/lib/i18n";
import { isNotificationEnabled } from "@/server/queries/notification-settings";
import { syncTaskToGoogle } from "@/server/google/calendar";
import { notify } from "@/server/notify";
import type { TaskStatus } from "@/generated/prisma/enums";

const createTaskSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1, "Введіть назву").max(200),
  status: z.enum(["IDEA", "TODO", "IN_PROGRESS", "TO_REVIEW", "DONE"]).default("TODO"),
  priority: z.number().int().min(1).max(10).default(5),
  plannedMinutes: z.number().int().positive().nullable().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  scheduledAt: z.string().optional(), // старт (дата+время) для календаря
  parentId: z.string().optional(),
  recurringTaskId: z.string().optional(),
  fromSummary: z.boolean().optional(),      // ручний тег «з самарі»
  assignedByManager: z.boolean().optional(), // ручний тег «від керівника»
});

export async function createTask(input: z.infer<typeof createTaskSchema>) {
  const user = await requireUser();
  const data = createTaskSchema.parse(input);
  const projectId = data.projectId || null;
  // задача не может существовать без исполнителя — по умолчанию это создатель
  const assigneeId = data.assigneeId || user.id;

  const last = await db.task.findFirst({
    where: { projectId, status: data.status, parentId: data.parentId ?? null },
    orderBy: { position: "desc" },
  });

  // задача от руководителя: ручной тег ИЛИ авто (назначена другому руководителем/админом)
  let assignedByManager = data.assignedByManager ?? false;
  if (!assignedByManager && assigneeId !== user.id) {
    if (user.role === "OWNER" || user.role === "ADMIN") assignedByManager = true;
    else {
      const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { managerId: true } });
      if (assignee?.managerId === user.id) assignedByManager = true;
    }
  }

  // старт задачи → scheduledAt (для календаря): явный scheduledAt или дедлайн+время (обратная совместимость)
  let scheduledAt: Date | null = null;
  const dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.scheduledAt) {
    const [sd, st] = data.scheduledAt.split("T");
    scheduledAt = zonedTimeToUtc(sd, st ?? "00:00", user.timezone);
  } else if (data.dueDate && data.dueTime) {
    scheduledAt = zonedTimeToUtc(data.dueDate, data.dueTime, user.timezone);
  }

  const task = await db.task.create({
    data: {
      title: data.title,
      status: data.status,
      priority: data.priority,
      plannedMinutes: data.plannedMinutes ?? null,
      projectId,
      parentId: data.parentId ?? null,
      createdById: user.id,
      dueDate,
      scheduledAt,
      assignedByManager,
      fromSummary: data.fromSummary ?? false,
      recurringTaskId: data.recurringTaskId ?? null,
      position: (last?.position ?? -1) + 1,
      assignees: { create: [{ userId: assigneeId }] },
    },
  });

  await db.activity.create({
    data: { type: "task.created", actorId: user.id, projectId, taskId: task.id, meta: task.title },
  });

  // уведомление исполнителю о поставленной задаче
  if (assignedByManager && (await isNotificationEnabled("assignment"))) {
    await notify({ recipientId: assigneeId, type: "assignment", message: `${user.name} поставив вам задачу «${task.title}»`, link: `/tasks/${task.id}`, actorId: user.id });
  }

  await syncTaskToGoogle(task.id); // best-effort: событие в Google Calendar исполнителя

  if (projectId) revalidatePath(`/projects/${projectId}`);
  if (data.parentId) revalidatePath(`/tasks/${data.parentId}`);
  revalidatePath("/");
  return task;
}

// Перемещение задачи между колонками канбана / внутри колонки
// Закрыть висящие задачи «Перевірити «…»» для задачи, когда её закрыли ЛЮБЫМ путём
// (вердикт, смена статуса, чекбокс на доске, масове закриття). Маркер — /tasks/<id> в описі.
async function closeCheckTasksFor(taskId: string) {
  await db.task.updateMany({
    where: { description: `/tasks/${taskId}`, status: { not: "DONE" } },
    data: { status: "DONE", completedAt: new Date() },
  });
}

export async function moveTask(input: {
  taskId: string;
  toStatus: TaskStatus;
  toIndex: number;
}) {
  const user = await requireUser();
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
  if (toStatus === "DONE") await closeCheckTasksFor(taskId);

  if (task.status !== toStatus) {
    await db.activity.create({
      data: { type: "task.status", actorId: user.id, projectId: task.projectId, taskId, meta: JSON.stringify({ title: task.title, to: toStatus }) },
    });
  }

  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/");
}

const updateTaskSchema = z.object({
  taskId: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  status: z.enum(["IDEA", "TODO", "IN_PROGRESS", "TO_REVIEW", "DONE"]).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  plannedMinutes: z.number().int().positive().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(), // старт (дата+час) для календаря
});

export async function updateTask(input: z.infer<typeof updateTaskSchema>) {
  const user = await requireUser();
  const data = updateTaskSchema.parse(input);
  const { taskId, dueDate, scheduledAt, status, ...rest } = data;

  const prev = status ? await db.task.findUnique({ where: { id: taskId }, select: { status: true } }) : null;

  const task = await db.task.update({
    where: { id: taskId },
    data: {
      ...rest,
      ...(status ? { status, completedAt: status === "DONE" ? new Date() : null } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(scheduledAt !== undefined
        ? { scheduledAt: scheduledAt ? zonedTimeToUtc(scheduledAt.split("T")[0], scheduledAt.split("T")[1] ?? "00:00", user.timezone) : null }
        : {}),
    },
  });

  if (status && prev && prev.status !== status) {
    await db.activity.create({
      data: { type: "task.status", actorId: user.id, projectId: task.projectId, taskId, meta: JSON.stringify({ title: task.title, to: status }) },
    });
  }

  if (status === "DONE") await closeCheckTasksFor(taskId);

  await syncTaskToGoogle(taskId); // best-effort: обновить событие в Google Calendar

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/");
}

// Массовая смена статуса выбранных задач
export async function bulkSetStatus(input: { taskIds: string[]; status: TaskStatus }) {
  const user = await requireUser();
  const ids = [...new Set(input.taskIds)].filter(Boolean);
  if (ids.length === 0) return;
  const tasks = await db.task.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, projectId: true, status: true } });
  await db.task.updateMany({
    where: { id: { in: ids } },
    data: { status: input.status, completedAt: input.status === "DONE" ? new Date() : null },
  });
  await db.activity.createMany({
    data: tasks.filter((t) => t.status !== input.status).map((t) => ({
      type: "task.status", actorId: user.id, projectId: t.projectId, taskId: t.id,
      meta: JSON.stringify({ title: t.title, to: input.status }),
    })),
  });
  if (input.status === "DONE") {
    for (const t of tasks) await closeCheckTasksFor(t.id);
  }
  revalidatePath("/", "layout");
}

// Полное удаление задачи. Право: владелец/админ, автор, исполнитель
// или руководитель исполнителя. Каскады подчищают чек-лист/комментарии/сабтаски.
export async function deleteTask(taskId: string) {
  const user = await requireUser();
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { assignees: { include: { user: { select: { id: true, managerId: true } } } } },
  });
  if (!task) return { error: null, projectId: null };
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";
  const isMine = task.createdById === user.id || task.assignees.some((a) => a.user.id === user.id);
  const managesAssignee = task.assignees.some((a) => a.user.managerId === user.id);
  if (!isAdmin && !isMine && !managesAssignee) return { error: "Немає прав", projectId: null };

  await db.task.delete({ where: { id: taskId } });
  // «Перевірити …» для удалённой задачи больше не имеют смысла — убираем незакрытые
  await db.task.deleteMany({ where: { description: `/tasks/${taskId}`, status: { not: "DONE" } } });

  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/");
  return { error: null, projectId: task.projectId };
}

// Отправить задачу на проверку руководителю
export async function sendForReview(taskId: string) {
  const user = await requireUser();
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { assignees: { include: { user: { select: { managerId: true } } } } },
  });
  if (!task) return;

  await db.task.update({ where: { id: taskId }, data: { status: "TO_REVIEW", reviewRequestedAt: new Date() } });
  await db.activity.create({
    data: { type: "task.status", actorId: user.id, projectId: task.projectId, taskId: task.id, meta: JSON.stringify({ title: task.title, to: "TO_REVIEW" }) },
  });

  // уведомляем руководителя исполнителя (или всех админов/владельцев)
  const managerIds = new Set<string>();
  for (const a of task.assignees) if (a.user.managerId) managerIds.add(a.user.managerId);
  if (managerIds.size === 0) {
    const admins = await db.user.findMany({ where: { role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
    for (const a of admins) managerIds.add(a.id);
  }
  managerIds.delete(user.id);
  if (await isNotificationEnabled("review")) {
    await Promise.all(
      [...managerIds].map((rid) =>
        notify({ recipientId: rid, type: "review", message: `${user.name} відправив на перевірку «${task.title}»`, link: `/tasks/${task.id}`, actorId: user.id }),
      ),
    );
  }

  // Керівнику падає особиста задача «Перевірити «…»» з дедлайном на сьогодні.
  // Маркер зв'язку — посилання /tasks/<id> в описі: після вердикту вона закриється сама.
  const marker = `/tasks/${task.id}`;
  const managers = await db.user.findMany({
    where: { id: { in: [...managerIds] } },
    select: { id: true, locale: true, timezone: true },
  });
  for (const m of managers) {
    const existing = await db.task.findFirst({
      where: { status: { not: "DONE" }, description: marker, assignees: { some: { userId: m.id } } },
      select: { id: true },
    });
    if (existing) continue; // повторна відправка — задача вже висить
    const tz = m.timezone || "Europe/Kyiv";
    const last = await db.task.findFirst({ where: { projectId: null, status: "TODO", parentId: null }, orderBy: { position: "desc" } });
    await db.task.create({
      data: {
        title: `${t(m.locale, "review.checkTitle")} «${task.title}»`,
        description: marker,
        status: "TODO",
        priority: task.priority,
        plannedMinutes: 15,
        createdById: user.id,
        dueDate: zonedTimeToUtc(zonedDateStr(new Date(), tz), "23:59", tz),
        position: (last?.position ?? -1) + 1,
        assignees: { create: [{ userId: m.id }] },
      },
    });
  }

  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/");
}

// Вердикт по задаче на проверке: принять или вернуть на доработку (причина обязательна).
// Результат летит исполнителю пушом + в колокол (тип review_result). Причина — комментарием в ленту.
export async function reviewTask(input: { taskId: string; decision: "approve" | "reject"; comment?: string }) {
  const user = await requireUser();
  const task = await db.task.findUnique({
    where: { id: input.taskId },
    include: { assignees: { include: { user: { select: { id: true, managerId: true } } } } },
  });
  if (!task) return { error: "Задачу не знайдено" };

  // Проверять может админ/владелец или руководитель исполнителя
  const managesAssignee = task.assignees.some((a) => a.user.managerId === user.id);
  if (user.role !== "OWNER" && user.role !== "ADMIN" && !managesAssignee) return { error: "Немає прав на перевірку" };

  const assigneeIds = task.assignees.map((a) => a.user.id).filter((id) => id !== user.id);

  if (input.decision === "reject") {
    const reason = (input.comment ?? "").trim();
    if (!reason) return { error: "Вкажіть, що доопрацювати" };

    // возврат с проверки — в «Зробити» исполнителя
    await db.task.update({ where: { id: task.id }, data: { status: "TODO", reviewRequestedAt: null } });
    await db.comment.create({ data: { taskId: task.id, authorId: user.id, body: reason } });
    await db.activity.create({ data: { type: "task.status", actorId: user.id, projectId: task.projectId, taskId: task.id, meta: JSON.stringify({ title: task.title, to: "TODO" }) } });

    await Promise.all(assigneeIds.map((rid) =>
      notify({ recipientId: rid, type: "review_result", message: `${user.name} повернув «${task.title}» на доопрацювання: ${reason}`, link: `/tasks/${task.id}`, actorId: user.id }),
    ));
  } else {
    await db.task.update({ where: { id: task.id }, data: { status: "DONE", completedAt: new Date() } });
    await db.activity.create({ data: { type: "task.status", actorId: user.id, projectId: task.projectId, taskId: task.id, meta: JSON.stringify({ title: task.title, to: "DONE" }) } });

    await Promise.all(assigneeIds.map((rid) =>
      notify({ recipientId: rid, type: "review_result", message: `${user.name} прийняв «${task.title}» ✅`, link: `/tasks/${task.id}`, actorId: user.id }),
    ));
  }

  // Особиста задача «Перевірити «…»» закривається автоматично (у всіх перевіряючих)
  await closeCheckTasksFor(input.taskId);

  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/tasks/${input.taskId}`);
  revalidatePath("/");
  return { error: null };
}

// «Моя часть готова, жду коллегу»: помечаем ожидание (или снимаем). Снимает вину за просрочку.
export async function setTaskWaiting(input: { taskId: string; waitingForId: string | null }) {
  const user = await requireUser();
  const task = await db.task.findUnique({ where: { id: input.taskId }, select: { createdById: true, assignees: { select: { userId: true } } } });
  if (!task) return { error: "Задачу не знайдено" };
  const isMine = task.createdById === user.id || task.assignees.some((a) => a.userId === user.id);
  if (!isMine && user.role !== "OWNER" && user.role !== "ADMIN") return { error: "Немає прав" };
  await db.task.update({
    where: { id: input.taskId },
    data: { waitingForId: input.waitingForId, waitingSince: input.waitingForId ? new Date() : null },
  });
  revalidatePath(`/tasks/${input.taskId}`);
  revalidatePath("/");
  return { error: null };
}

// Задача (successor) залежить від predecessor — той має бути завершений раніше
export async function addDependency(input: { taskId: string; predecessorId: string }) {
  await requireUser();
  const { taskId, predecessorId } = input;
  if (!predecessorId || predecessorId === taskId) return { error: "Некоректна залежність" };
  // защита от прямого цикла: predecessor не должен уже зависеть от этой задачи
  const reverse = await db.taskDependency.findUnique({ where: { predecessorId_successorId: { predecessorId: taskId, successorId: predecessorId } } });
  if (reverse) return { error: "Це створило б цикл" };
  await db.taskDependency.upsert({
    where: { predecessorId_successorId: { predecessorId, successorId: taskId } },
    create: { predecessorId, successorId: taskId },
    update: {},
  });
  revalidatePath(`/tasks/${taskId}`);
  return { error: null };
}

export async function removeDependency(dependencyId: string) {
  await requireUser();
  const dep = await db.taskDependency.findUnique({ where: { id: dependencyId } });
  if (!dep) return;
  await db.taskDependency.delete({ where: { id: dependencyId } });
  revalidatePath(`/tasks/${dep.successorId}`);
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
