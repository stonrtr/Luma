import "server-only";
import { db } from "@/server/db";
import { mondayOf, addDays } from "@/lib/week";

export type ReportPeriod = "week" | "month" | "quarter" | "all" | "custom";

// Диапазон [from, to) по пресету периода.
export function periodRange(period: ReportPeriod, now = new Date()): { from: Date; to: Date } {
  if (period === "week") { const from = mondayOf(now); return { from, to: addDays(from, 7) }; }
  if (period === "month") { const from = new Date(now.getFullYear(), now.getMonth(), 1); return { from, to: new Date(now.getFullYear(), now.getMonth() + 1, 1) }; }
  if (period === "quarter") { const q = Math.floor(now.getMonth() / 3) * 3; const from = new Date(now.getFullYear(), q, 1); return { from, to: new Date(now.getFullYear(), q + 3, 1) }; }
  return { from: new Date(2000, 0, 1), to: addDays(now, 1) }; // all
}

// Рабочие дни (Пн–Пт) в [from, min(to, now)] — для расчёта плановой ёмкости.
function businessDays(from: Date, to: Date, now = new Date()): number {
  const end = to < now ? to : now;
  let n = 0;
  const d = new Date(from); d.setHours(0, 0, 0, 0);
  while (d < end) { const wd = d.getDay(); if (wd !== 0 && wd !== 6) n++; d.setDate(d.getDate() + 1); }
  return n;
}

export async function getTimeReport(period: ReportPeriod = "month", custom?: { from?: string; to?: string }) {
  const now = new Date();
  let from: Date, to: Date;
  if (period === "custom" && custom?.from && custom?.to) {
    from = new Date(custom.from); from.setHours(0, 0, 0, 0);
    to = new Date(custom.to); to.setHours(0, 0, 0, 0); to = addDays(to, 1); // конец диапазона включительно
  } else {
    ({ from, to } = periodRange(period === "custom" ? "month" : period, now));
  }
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const bizDays = businessDays(from, to, now);

  const [logs, members, doneInPeriod, overdueTasks] = await Promise.all([
    db.timeLog.findMany({
      where: { loggedAt: { gte: from, lt: to } },
      include: { user: true, task: { include: { project: true } } },
      orderBy: { loggedAt: "desc" },
    }),
    // ростер команды (для плановой ёмкости и списка людей, даже с 0 часов)
    db.user.findMany({ where: { isActive: true, role: { not: "CLIENT" } }, select: { id: true, name: true, hourlyRate: true, weeklyHours: true } }),
    // задачи, завершённые в периоде — «выполнено»
    db.task.findMany({ where: { completedAt: { gte: from, lt: to } }, select: { id: true, projectId: true, assignees: { select: { userId: true } } } }),
    // просроченные сейчас (не завершены, дедлайн в прошлом)
    db.task.findMany({ where: { archivedAt: null, status: { not: "DONE" }, dueDate: { lt: today } }, select: { id: true, projectId: true, assignees: { select: { userId: true } } } }),
  ]);

  const total = logs.reduce((s, l) => s + l.minutes, 0);

  // плановая ёмкость имеет смысл только для ограниченного периода; для «всего времени» — 0 (не показываем)
  const capacityOn = period !== "all";
  type U = { id: string; name: string; minutes: number; rate: number | null; capacityMin: number; tasksDone: number; overdue: number };
  const byUser = new Map<string, U>();
  for (const m of members) {
    byUser.set(m.id, {
      id: m.id, name: m.name, minutes: 0, rate: m.hourlyRate,
      capacityMin: capacityOn ? Math.round(((m.weeklyHours ?? 40) / 5) * bizDays * 60) : 0,
      tasksDone: 0, overdue: 0,
    });
  }

  type P = { id: string; name: string; color: string; minutes: number; cost: number; budget: number | null; overdue: number };
  const byProject = new Map<string, P>();

  for (const l of logs) {
    const u = byUser.get(l.userId);
    if (u) u.minutes += l.minutes;
    const p = l.task.project;
    if (!p) continue;
    const pr = byProject.get(p.id) ?? { id: p.id, name: p.name, color: p.color, minutes: 0, cost: 0, budget: p.budget, overdue: 0 };
    pr.minutes += l.minutes;
    pr.cost += l.user.hourlyRate ? (l.minutes / 60) * l.user.hourlyRate : 0;
    byProject.set(p.id, pr);
  }

  for (const t of doneInPeriod) for (const a of t.assignees) { const u = byUser.get(a.userId); if (u) u.tasksDone++; }
  for (const t of overdueTasks) {
    for (const a of t.assignees) { const u = byUser.get(a.userId); if (u) u.overdue++; }
    if (t.projectId) { const pr = byProject.get(t.projectId); if (pr) pr.overdue++; }
  }

  const cost = [...byUser.values()].reduce((s, u) => s + (u.rate ? (u.minutes / 60) * u.rate : 0), 0);

  return {
    period, from: from.toISOString(), to: to.toISOString(),
    total, cost,
    tasksDone: doneInPeriod.length,
    overdueNow: overdueTasks.length,
    participants: [...byUser.values()].filter((u) => u.minutes > 0).length,
    logs: logs.slice(0, 30),
    byUser: [...byUser.values()].sort((a, b) => b.minutes - a.minutes),
    byProject: [...byProject.values()].sort((a, b) => b.minutes - a.minutes),
  };
}

// Отчёт по КОМАНДЕ на основе задач, сроков и KPI (а не учёта времени).
export async function getTaskReport(period: ReportPeriod = "month", custom?: { from?: string; to?: string }) {
  const now = new Date();
  let from: Date, to: Date;
  if (period === "custom" && custom?.from && custom?.to) {
    from = new Date(custom.from); from.setHours(0, 0, 0, 0);
    to = new Date(custom.to); to.setHours(0, 0, 0, 0); to = addDays(to, 1);
  } else {
    ({ from, to } = periodRange(period === "custom" ? "month" : period, now));
  }
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  const [members, doneTasks, activeTasks, projects, kpis] = await Promise.all([
    db.user.findMany({ where: { isActive: true, role: { not: "CLIENT" } }, select: { id: true, name: true } }),
    // выполнено за период
    db.task.findMany({ where: { completedAt: { gte: from, lt: to } }, select: { id: true, dueDate: true, completedAt: true, projectId: true, assignees: { select: { userId: true } } } }),
    // активные сейчас (не завершены, не в архиве) — для «в работе» и «просрочено»
    db.task.findMany({ where: { archivedAt: null, status: { not: "DONE" } }, select: { id: true, dueDate: true, projectId: true, assignees: { select: { userId: true } } } }),
    db.project.findMany({ where: { archivedAt: null }, select: { id: true, name: true, color: true, status: true } }),
    // KPI текущего месяца
    db.kpi.findMany({ where: { year: now.getFullYear(), month: now.getMonth() }, select: { userId: true, achieved: true } }),
  ]);

  type U = { id: string; name: string; done: number; onTime: number; inProgress: number; overdue: number; kpiDone: number; kpiTotal: number };
  const byUser = new Map<string, U>();
  for (const m of members) byUser.set(m.id, { id: m.id, name: m.name, done: 0, onTime: 0, inProgress: 0, overdue: 0, kpiDone: 0, kpiTotal: 0 });

  for (const t of doneTasks) {
    const onTime = !t.dueDate || (t.completedAt != null && t.completedAt <= t.dueDate);
    for (const a of t.assignees) { const u = byUser.get(a.userId); if (u) { u.done++; if (onTime) u.onTime++; } }
  }
  for (const t of activeTasks) {
    const od = t.dueDate != null && t.dueDate < today;
    for (const a of t.assignees) { const u = byUser.get(a.userId); if (u) { u.inProgress++; if (od) u.overdue++; } }
  }
  for (const k of kpis) { const u = byUser.get(k.userId); if (u) { u.kpiTotal++; if (k.achieved === true) u.kpiDone++; } }

  // по проектам
  type P = { id: string; name: string; color: string; status: string; active: number; overdue: number; done: number };
  const byProject = new Map<string, P>();
  for (const p of projects) byProject.set(p.id, { id: p.id, name: p.name, color: p.color, status: p.status, active: 0, overdue: 0, done: 0 });
  for (const t of activeTasks) { if (!t.projectId) continue; const p = byProject.get(t.projectId); if (!p) continue; p.active++; if (t.dueDate != null && t.dueDate < today) p.overdue++; }
  for (const t of doneTasks) { if (!t.projectId) continue; const p = byProject.get(t.projectId); if (p) p.done++; }

  const doneTotal = doneTasks.length;
  const onTimeTotal = doneTasks.filter((t) => !t.dueDate || (t.completedAt != null && t.completedAt <= t.dueDate)).length;
  const overdueTotal = activeTasks.filter((t) => t.dueDate != null && t.dueDate < today).length;
  const kpiTotal = kpis.length;
  const kpiDone = kpis.filter((k) => k.achieved === true).length;

  return {
    period, from: from.toISOString(), to: to.toISOString(),
    doneTotal,
    inProgressTotal: activeTasks.length,
    overdueTotal,
    onTimePct: doneTotal ? Math.round((onTimeTotal / doneTotal) * 100) : null,
    kpiDone, kpiTotal,
    byUser: [...byUser.values()].sort((a, b) => b.done - a.done || b.inProgress - a.inProgress),
    byProject: [...byProject.values()].filter((p) => p.active > 0 || p.done > 0).sort((a, b) => b.overdue - a.overdue || b.active - a.active),
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
