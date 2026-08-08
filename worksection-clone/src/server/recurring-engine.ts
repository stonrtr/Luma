import "server-only";
import { db } from "@/server/db";
import { syncTaskToGoogle } from "@/server/google/calendar";

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Генерация экземпляров регулярных задач на сегодня (идемпотентно по lastGeneratedAt)
export async function generateDueRecurringTasks(): Promise<number> {
  const now = new Date();
  const weekday = ((now.getDay() + 6) % 7) + 1; // 1=Пн..7=Нд
  const recurring = await db.recurringTask.findMany({ where: { active: true } });
  let created = 0;

  for (const r of recurring) {
    if (r.lastGeneratedAt && sameDay(new Date(r.lastGeneratedAt), now)) continue;

    let due = false;
    if (r.frequency === "DAILY") due = true;
    else if (r.frequency === "WEEKLY") due = (r.weekdays ?? "").split(",").map((s) => s.trim()).includes(String(weekday));
    else if (r.frequency === "MONTHLY") due = r.dayOfMonth === now.getDate();
    if (!due) continue;

    const last = await db.task.findFirst({
      where: { projectId: r.projectId ?? null, status: "TODO", parentId: null },
      orderBy: { position: "desc" },
    });
    const dueDate = new Date(now); dueDate.setHours(23, 59, 0, 0);
    const task = await db.task.create({
      data: {
        title: r.title,
        status: "TODO",
        priority: r.priority,
        plannedMinutes: r.plannedMinutes,
        projectId: r.projectId ?? null,
        createdById: r.createdById,
        assignedByManager: r.createdById !== r.assigneeId,
        recurringTaskId: r.id,
        dueDate,
        position: (last?.position ?? -1) + 1,
        assignees: { create: [{ userId: r.assigneeId }] },
      },
    });
    await db.recurringTask.update({ where: { id: r.id }, data: { lastGeneratedAt: now } });
    await syncTaskToGoogle(task.id); // best-effort напоминание в календаре
    created++;
  }
  return created;
}
