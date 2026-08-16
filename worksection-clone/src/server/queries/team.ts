import "server-only";
import { db } from "@/server/db";
import { mondayOf, addDays } from "@/lib/week";

export async function getOrgUsers() {
  return db.user.findMany({
    where: { role: { not: "CLIENT" } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, title: true, functions: true, role: true,
      weeklyHours: true, managerId: true, isActive: true, email: true, driveFolderUrl: true,
      lastSeenAt: true, avatarUrl: true,
    },
  });
}

// Кому текущий пользователь может ставить задачи.
// Руководитель (админ или у кого есть подчинённые) — любой член команды,
// включая деактивированных («закриті»). Обычный сотрудник — только себе.
export async function getAssignableMembers(userId: string, role: string) {
  const isAdmin = role === "OWNER" || role === "ADMIN";
  const subordinates = isAdmin ? 1 : await db.user.count({ where: { managerId: userId } });
  const isManager = isAdmin || subordinates > 0;

  if (!isManager) {
    return db.user.findMany({
      where: { id: userId },
      select: { id: true, name: true, isActive: true },
    });
  }

  // активные сверху, деактивированные ниже — но видны все
  return db.user.findMany({
    where: { role: { not: "CLIENT" } },
    select: { id: true, name: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

// Обзор команды: участники + их незакрытые задачи с нагрузкой
export async function getTeamOverview() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 7);

  const [members, tasks, doneThisWeek] = await Promise.all([
    db.user.findMany({
      where: { role: { not: "CLIENT" }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, title: true, weeklyHours: true },
    }),
    db.task.findMany({
      where: { parentId: null, archivedAt: null, status: { not: "DONE" } },
      orderBy: [{ priority: "desc" }, { position: "asc" }],
      include: {
        project: { select: { name: true, color: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
      },
    }),
    // задачи, закрытые на этой неделе (для счётчика «закрито за тиждень»)
    db.task.findMany({
      where: { parentId: null, status: "DONE", completedAt: { gte: weekStart, lt: weekEnd } },
      select: { id: true, title: true, assignees: { select: { userId: true } } },
    }),
  ]);

  type TaskRef = { id: string; title: string };
  const load = new Map<string, {
    today: number; week: number; count: number;
    weekActiveTasks: TaskRef[]; weekDoneTasks: TaskRef[];
  }>();
  for (const m of members) load.set(m.id, { today: 0, week: 0, count: 0, weekActiveTasks: [], weekDoneTasks: [] });

  for (const t of tasks) {
    const due = t.scheduledAt ?? t.dueDate;
    const inWeek = !!due && due >= weekStart && due < weekEnd;
    for (const a of t.assignees) {
      const l = load.get(a.user.id);
      if (!l) continue;
      l.count += 1;
      if (due && due >= today && due < tomorrow) l.today += t.plannedMinutes ?? 0;
      if (inWeek) { l.week += t.plannedMinutes ?? 0; l.weekActiveTasks.push({ id: t.id, title: t.title }); }
    }
  }

  for (const t of doneThisWeek) {
    for (const a of t.assignees) {
      const l = load.get(a.userId);
      if (l) l.weekDoneTasks.push({ id: t.id, title: t.title });
    }
  }

  const withLoad = members.map((m) => {
    const l = load.get(m.id)!;
    const dailyCap = m.weeklyHours ? Math.round((m.weeklyHours / 5) * 60) : 480;
    const weekCap = m.weeklyHours ? Math.round(m.weeklyHours * 60) : 2400;
    return {
      ...m, todayMin: l.today, weekMin: l.week, taskCount: l.count,
      weekActive: l.weekActiveTasks.length, weekDone: l.weekDoneTasks.length,
      weekActiveTasks: l.weekActiveTasks, weekDoneTasks: l.weekDoneTasks,
      dailyCap, weekCap,
    };
  });

  return { members: withLoad, tasks };
}
