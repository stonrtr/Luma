import "server-only";
import { db } from "@/server/db";
import { weekStartInTz } from "@/lib/week";

export async function getPlanning(userId: string, ref: Date = new Date()) {
  const year = ref.getFullYear();
  const month = ref.getMonth();
  // Неделя — в часовом поясе самого сотрудника (маркер понедельника 00:00 UTC)
  const tz = (await db.user.findUnique({ where: { id: userId }, select: { timezone: true } }))?.timezone || "Europe/Kyiv";
  const weekStart = weekStartInTz(tz, ref);

  const [user, goals, kpis, planItems, projects, recurring] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, title: true, managerId: true } }),
    db.monthlyGoal.findMany({ where: { userId, year, month }, orderBy: { createdAt: "asc" } }),
    db.kpi.findMany({ where: { userId, year, month }, orderBy: { createdAt: "asc" } }),
    db.weeklyPlanItem.findMany({
      where: { userId, weekStart },
      orderBy: [{ priority: "desc" }, { order: "asc" }],
      include: { task: { select: { id: true, status: true } } },
    }),
    db.project.findMany({
      where: { members: { some: { userId } }, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    db.recurringTask.findMany({
      where: { assigneeId: userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { user, year, month, weekStart, goals, kpis, planItems, projects, recurring };
}

// Если KPI на текущий месяц не заданы — переносим их из прошлого месяца (авто-KPI).
export async function ensureMonthlyKpis(userId: string, ref: Date = new Date()) {
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const has = await db.kpi.count({ where: { userId, year, month } });
  if (has > 0) return;
  const prev = new Date(year, month - 1, 1);
  const prevKpis = await db.kpi.findMany({
    where: { userId, year: prev.getFullYear(), month: prev.getMonth() },
    orderBy: { createdAt: "asc" },
  });
  if (prevKpis.length === 0) return;
  await db.kpi.createMany({
    data: prevKpis.map((k) => ({ userId, year, month, title: k.title, target: k.target })),
  });
}

// Регулярки команды: для OWNER/ADMIN — всех участников, для руководителя — подчинённых.
export async function getTeamRecurringForViewer(viewerId: string, role: string) {
  const isAdmin = role === "OWNER" || role === "ADMIN";
  const members = isAdmin
    ? await db.user.findMany({ where: { role: { not: "CLIENT" }, id: { not: viewerId } }, select: { id: true } })
    : await db.user.findMany({ where: { managerId: viewerId }, select: { id: true } });
  if (members.length === 0) return [];
  return db.recurringTask.findMany({
    where: { assigneeId: { in: members.map((m) => m.id) }, active: true },
    orderBy: { createdAt: "asc" },
    include: { assignee: { select: { name: true } } },
  });
}

export async function getRecurringForUser(userId: string) {
  return db.recurringTask.findMany({ where: { assigneeId: userId, active: true }, orderBy: { createdAt: "asc" } });
}

// Архив KPI: цели прошлых месяцев, сгруппированные по месяцу
export async function getKpiArchive(userId: string, ref: Date = new Date()) {
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const rows = await db.kpi.findMany({
    where: { userId, OR: [{ year: { lt: year } }, { year, month: { lt: month } }] },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "asc" }],
  });
  const groups = new Map<string, { year: number; month: number; kpis: typeof rows }>();
  for (const k of rows) {
    const key = `${k.year}-${k.month}`;
    if (!groups.has(key)) groups.set(key, { year: k.year, month: k.month, kpis: [] });
    groups.get(key)!.kpis.push(k);
  }
  return [...groups.values()];
}

// Архив недельных приоритетов: планы прошлых недель, сгруппированные по неделе
export async function getPlanArchive(userId: string, ref: Date = new Date()) {
  const tz = (await db.user.findUnique({ where: { id: userId }, select: { timezone: true } }))?.timezone || "Europe/Kyiv";
  const ws = weekStartInTz(tz, ref);
  const rows = await db.weeklyPlanItem.findMany({
    where: { userId, weekStart: { lt: ws } },
    orderBy: [{ weekStart: "desc" }, { priority: "desc" }, { order: "asc" }],
    include: { task: { select: { id: true, status: true } } },
    take: 200,
  });
  const groups = new Map<number, { weekStart: Date; items: typeof rows }>();
  for (const r of rows) {
    const key = r.weekStart.getTime();
    if (!groups.has(key)) groups.set(key, { weekStart: r.weekStart, items: [] });
    groups.get(key)!.items.push(r);
  }
  return [...groups.values()];
}

// KPI пользователя за месяц (для показа на вкладке «Задачі»)
export async function getMonthlyKpis(userId: string, ref: Date = new Date()) {
  return db.kpi.findMany({
    where: { userId, year: ref.getFullYear(), month: ref.getMonth() },
    orderBy: { createdAt: "asc" },
  });
}

// Список подчинённых (для руководителя) + сам пользователь
export async function getPlanningTargets(viewerId: string, role: string) {
  if (role === "OWNER" || role === "ADMIN") {
    return db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, title: true },
      orderBy: { name: "asc" },
    });
  }
  return db.user.findMany({
    where: { OR: [{ id: viewerId }, { managerId: viewerId }], isActive: true },
    select: { id: true, name: true, title: true },
    orderBy: { name: "asc" },
  });
}
