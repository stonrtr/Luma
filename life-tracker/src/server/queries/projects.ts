import "server-only";
import { db } from "@/server/db";
import { mondayOf } from "@/lib/week";

// Витрачений час (хвилини) користувача по кожному проєкту: за поточний тиждень і місяць.
// Джерело — TimeLog, привʼязаний до задач проєкту. Повертає Map projectId → {week, month}.
async function sumProjectTime(userId: string, projectIds: string[]): Promise<Map<string, { week: number; month: number }>> {
  const out = new Map<string, { week: number; month: number }>();
  if (projectIds.length === 0) return out;
  const now = new Date();
  const weekStart = mondayOf(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const logs = await db.timeLog.findMany({
    where: { userId, loggedAt: { gte: monthStart }, task: { projectId: { in: projectIds } } },
    select: { minutes: true, loggedAt: true, task: { select: { projectId: true } } },
  });
  for (const l of logs) {
    const pid = l.task.projectId;
    if (!pid) continue;
    const acc = out.get(pid) ?? { week: 0, month: 0 };
    acc.month += l.minutes;
    if (new Date(l.loggedAt) >= weekStart) acc.week += l.minutes;
    out.set(pid, acc);
  }
  return out;
}

// Час на один вектор (для сторінки вектора).
export async function getProjectTimeStats(projectId: string, userId: string): Promise<{ week: number; month: number }> {
  const m = await sumProjectTime(userId, [projectId]);
  return m.get(projectId) ?? { week: 0, month: 0 };
}

// Регулярні задачі, привʼязані до вектора (окрема сутність).
export async function getRecurringForProject(projectId: string) {
  return db.recurringTask.findMany({
    where: { projectId, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, priority: true, frequency: true, weekdays: true, dayOfMonth: true },
  });
}

// Проекты, в которых пользователь состоит участником (или все — для админа)
export async function getProjectsForUser(userId: string, opts?: { all?: boolean }) {
  const projects = await db.project.findMany({
    where: opts?.all ? {} : { members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: { include: { user: true } },
      _count: { select: { tasks: true } },
    },
  });

  // прогресс по каждому проекту (доля выполненных задач)
  const withProgress = await Promise.all(
    projects.map(async (p) => {
      const [done, total] = await Promise.all([
        db.task.count({ where: { projectId: p.id, status: "DONE", parentId: null } }),
        db.task.count({ where: { projectId: p.id, parentId: null } }),
      ]);
      return { ...p, doneCount: done, totalCount: total };
    }),
  );

  return withProgress;
}

// Зведення по всіх «векторах» (проєктах) користувача: прогрес, розклад по статусах,
// динаміка за 7 днів і сигнал «є прогрес / застій». Ядро сторінки «Огляд».
export type VectorOverview = {
  id: string;
  name: string;
  color: string;
  status: string;
  total: number;
  done: number;
  progress: number; // 0..100
  counts: { IDEA: number; TODO: number; IN_PROGRESS: number; TO_REVIEW: number; DONE: number };
  open: number; // не DONE
  overdue: number;
  doneLast7: number;
  createdLast7: number;
  weekMinutes: number; // витрачений час цього тижня
  monthMinutes: number; // витрачений час цього місяця
  lastActivityAt: string | null;
  lastDoneAt: string | null;
  momentum: "active" | "stalled" | "idle" | "done"; // застій vs прогрес
};

export async function getVectorsOverview(userId: string, opts?: { all?: boolean }): Promise<VectorOverview[]> {
  const projects = await db.project.findMany({
    where: opts?.all ? {} : { members: { some: { userId } } },
    select: { id: true, name: true, color: true, status: true },
    orderBy: { updatedAt: "desc" },
  });
  if (projects.length === 0) return [];

  const ids = projects.map((p) => p.id);
  const [tasks, timeByProject] = await Promise.all([
    db.task.findMany({
      where: { projectId: { in: ids }, parentId: null },
      select: { projectId: true, status: true, dueDate: true, completedAt: true, updatedAt: true, createdAt: true },
    }),
    sumProjectTime(userId, ids),
  ]);

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  return projects.map((p) => {
    const own = tasks.filter((t) => t.projectId === p.id);
    const counts = { IDEA: 0, TODO: 0, IN_PROGRESS: 0, TO_REVIEW: 0, DONE: 0 };
    let overdue = 0, doneLast7 = 0, createdLast7 = 0;
    let lastActivity = 0, lastDone = 0;
    for (const t of own) {
      counts[t.status as keyof typeof counts]++;
      const done = t.status === "DONE";
      if (!done && t.dueDate && new Date(t.dueDate).getTime() < now) overdue++;
      if (done && t.completedAt && new Date(t.completedAt).getTime() >= weekAgo) doneLast7++;
      if (new Date(t.createdAt).getTime() >= weekAgo) createdLast7++;
      const upd = new Date(t.updatedAt).getTime();
      if (upd > lastActivity) lastActivity = upd;
      if (done && t.completedAt) { const c = new Date(t.completedAt).getTime(); if (c > lastDone) lastDone = c; }
    }
    const total = own.length;
    const done = counts.DONE;
    const open = total - done;
    const progress = total ? Math.round((done / total) * 100) : 0;

    let momentum: VectorOverview["momentum"];
    if (total > 0 && open === 0) momentum = "done";
    else if (doneLast7 > 0) momentum = "active";
    else if (open > 0 && (lastActivity === 0 || lastActivity < weekAgo)) momentum = "stalled";
    else momentum = "idle";

    const time = timeByProject.get(p.id) ?? { week: 0, month: 0 };
    return {
      id: p.id, name: p.name, color: p.color, status: p.status,
      total, done, progress, counts, open, overdue, doneLast7, createdLast7,
      weekMinutes: time.week, monthMinutes: time.month,
      lastActivityAt: lastActivity ? new Date(lastActivity).toISOString() : null,
      lastDoneAt: lastDone ? new Date(lastDone).toISOString() : null,
      momentum,
    };
  });
}

export async function getProjectById(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      members: { include: { user: true } },
      milestones: true,
      tags: true,
    },
  });
}

export async function isProjectMember(projectId: string, userId: string) {
  const m = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return !!m;
}
