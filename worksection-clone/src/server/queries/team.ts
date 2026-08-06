import "server-only";
import { db } from "@/server/db";
import { mondayOf, addDays } from "@/lib/week";

export async function getOrgUsers() {
  return db.user.findMany({
    where: { role: { not: "CLIENT" } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, title: true, functions: true, role: true,
      weeklyHours: true, managerId: true, isActive: true, email: true,
    },
  });
}

// Обзор команды: участники + их незакрытые задачи с нагрузкой
export async function getTeamOverview() {
  const [members, tasks] = await Promise.all([
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
  ]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 7);

  const load = new Map<string, { today: number; week: number; count: number }>();
  for (const m of members) load.set(m.id, { today: 0, week: 0, count: 0 });

  for (const t of tasks) {
    const due = t.scheduledAt ?? t.dueDate;
    for (const a of t.assignees) {
      const l = load.get(a.user.id);
      if (!l) continue;
      l.count += 1;
      if (due && due >= today && due < tomorrow) l.today += t.plannedMinutes ?? 0;
      if (due && due >= weekStart && due < weekEnd) l.week += t.plannedMinutes ?? 0;
    }
  }

  const withLoad = members.map((m) => {
    const l = load.get(m.id)!;
    const dailyCap = m.weeklyHours ? Math.round((m.weeklyHours / 5) * 60) : 480;
    const weekCap = m.weeklyHours ? Math.round(m.weeklyHours * 60) : 2400;
    return { ...m, todayMin: l.today, weekMin: l.week, taskCount: l.count, dailyCap, weekCap };
  });

  return { members: withLoad, tasks };
}
