import "server-only";
import { db } from "@/server/db";

export async function getTimeReport() {
  const logs = await db.timeLog.findMany({
    include: {
      user: true,
      task: { include: { project: true } },
    },
    orderBy: { loggedAt: "desc" },
  });

  const total = logs.reduce((s, l) => s + l.minutes, 0);

  const byUser = new Map<string, { name: string; minutes: number; rate: number | null }>();
  const byProject = new Map<
    string,
    { name: string; color: string; minutes: number; cost: number; budget: number | null }
  >();

  for (const l of logs) {
    const u = byUser.get(l.userId) ?? { name: l.user.name, minutes: 0, rate: l.user.hourlyRate };
    u.minutes += l.minutes;
    byUser.set(l.userId, u);

    const p = l.task.project;
    if (!p) continue; // задача без проекта
    const pr =
      byProject.get(p.id) ?? { name: p.name, color: p.color, minutes: 0, cost: 0, budget: p.budget };
    pr.minutes += l.minutes;
    pr.cost += l.user.hourlyRate ? (l.minutes / 60) * l.user.hourlyRate : 0;
    byProject.set(p.id, pr);
  }

  return {
    total,
    logs: logs.slice(0, 30),
    byUser: [...byUser.values()].sort((a, b) => b.minutes - a.minutes),
    byProject: [...byProject.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.minutes - a.minutes),
  };
}

// Задачи со сроком в заданном месяце — для календаря
export async function getCalendarTasks(userId: string, year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  return db.task.findMany({
    where: {
      dueDate: { gte: from, lt: to },
      project: { members: { some: { userId } } },
    },
    include: { project: true, assignees: { include: { user: true } } },
    orderBy: { dueDate: "asc" },
  });
}
