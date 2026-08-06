import "server-only";
import { db } from "@/server/db";
import { addDays } from "@/lib/week";

// Календарь всей команды: задачи (по scheduledAt/dueDate) и звонки за месяц
export async function getCalendarData(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);

  const [tasks, calls, users] = await Promise.all([
    db.task.findMany({
      where: {
        parentId: null,
        archivedAt: null,
        OR: [
          { scheduledAt: { gte: from, lt: to } },
          { dueDate: { gte: from, lt: to }, scheduledAt: null },
        ],
      },
      include: {
        project: { select: { color: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
      },
    }),
    db.call.findMany({
      where: { scheduledAt: { gte: from, lt: to } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, isActive: true }, select: { id: true, name: true } }),
  ]);

  return { tasks, calls, users };
}

// Недельный тайм-грид: задачи, звонки и учтённое время пользователя за неделю
export async function getMyWeek(userId: string, weekStart: Date) {
  const from = weekStart;
  const to = addDays(weekStart, 7);
  const [tasks, calls, logs, user] = await Promise.all([
    db.task.findMany({
      where: {
        parentId: null, archivedAt: null, assignees: { some: { userId } },
        OR: [{ scheduledAt: { gte: from, lt: to } }, { dueDate: { gte: from, lt: to } }],
      },
      include: { project: { select: { color: true } } },
    }),
    db.call.findMany({ where: { userId, scheduledAt: { gte: from, lt: to } } }),
    db.timeLog.findMany({ where: { userId, loggedAt: { gte: from, lt: to } }, select: { minutes: true, loggedAt: true } }),
    db.user.findUnique({ where: { id: userId }, select: { weeklyHours: true } }),
  ]);
  return { tasks, calls, logs, weeklyHours: user?.weeklyHours ?? null };
}

// Персональный календарь: задачи и звонки текущего пользователя за месяц
export async function getMyCalendar(userId: string, year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  const [tasks, calls] = await Promise.all([
    db.task.findMany({
      where: {
        parentId: null,
        archivedAt: null,
        assignees: { some: { userId } },
        OR: [
          { scheduledAt: { gte: from, lt: to } },
          { dueDate: { gte: from, lt: to }, scheduledAt: null },
        ],
      },
      include: { project: { select: { color: true } } },
    }),
    db.call.findMany({ where: { userId, scheduledAt: { gte: from, lt: to } }, orderBy: { scheduledAt: "asc" } }),
  ]);
  return { tasks, calls };
}

