import "server-only";
import { db } from "@/server/db";
import { mondayOf } from "@/lib/week";

export async function getPlanning(userId: string, ref: Date = new Date()) {
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const weekStart = mondayOf(ref);

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
    db.recurringTask.findMany({ where: { assigneeId: userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return { user, year, month, weekStart, goals, kpis, planItems, projects, recurring };
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
