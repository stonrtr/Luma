import "server-only";
import { db } from "@/server/db";
import { syncTaskToGoogle } from "@/server/google/calendar";
import { zonedDateStr, zonedWeekday, zonedTimeToUtc } from "@/lib/tz";

// Экземпляры падают на доску только в свой день («сегодня»), один раз.
// Шаблоны и расписание видны во вкладке «Регулярні».
const HORIZON_DAYS = 1;

// Генерация экземпляров «день в день». lastGeneratedAt — «водяной знак»:
// по какую дату (в TZ исполнителя) уже обработано; удалённые/закрытые
// экземпляры не воскрешаем — день второй раз не рассматривается.
export async function generateDueRecurringTasks(): Promise<number> {
  const now = new Date();
  const recurring = await db.recurringTask.findMany({
    where: { active: true },
    include: { assignee: { select: { timezone: true } } },
  });
  let created = 0;

  for (const r of recurring) {
    const tz = r.assignee?.timezone || "Europe/Kyiv";
    const doneThrough = r.lastGeneratedAt ? zonedDateStr(new Date(r.lastGeneratedAt), tz) : "";
    let newDoneThrough = doneThrough;

    for (let offset = 0; offset < HORIZON_DAYS; offset++) {
      const day = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
      const dateStr = zonedDateStr(day, tz); // YYYY-MM-DD в TZ исполнителя
      if (doneThrough && dateStr <= doneThrough) continue;
      if (dateStr > newDoneThrough) newDoneThrough = dateStr;

      let due = false;
      if (r.frequency === "DAILY") due = true;
      else if (r.frequency === "WEEKLY") due = (r.weekdays ?? "").split(",").map((s) => s.trim()).includes(String(zonedWeekday(day, tz)));
      else if (r.frequency === "MONTHLY") {
        // 29–31 число: в коротких месяцах срабатывает в последний день месяца
        const dd = Number(dateStr.slice(8, 10));
        const [yy, mm] = dateStr.split("-").map(Number);
        const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
        due = r.dayOfMonth === dd || (!!r.dayOfMonth && r.dayOfMonth > lastDay && dd === lastDay);
      }
      if (!due) continue;

      const last = await db.task.findFirst({
        where: { projectId: r.projectId ?? null, status: "TODO", parentId: null },
        orderBy: { position: "desc" },
      });
      // Щомісячні: дедлайн — на своє число (може бути пізніше старту; якщо менше — наступний місяць)
      let dueStr = dateStr;
      if (r.frequency === "MONTHLY" && r.dueDayOfMonth && r.dueDayOfMonth !== r.dayOfMonth) {
        const [y, m] = dateStr.split("-").map(Number);
        let yy = y, mm = m;
        if (r.dueDayOfMonth < (r.dayOfMonth ?? 1)) { mm += 1; if (mm > 12) { mm = 1; yy += 1; } }
        const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
        const dd = Math.min(r.dueDayOfMonth, lastDay);
        dueStr = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      }
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
          dueDate: zonedTimeToUtc(dueStr, "23:59", tz), // конец дня исполнителя
          scheduledAt: r.startTime ? zonedTimeToUtc(dateStr, r.startTime, tz) : null, // в календарь по времени
          position: (last?.position ?? -1) + 1,
          assignees: { create: [{ userId: r.assigneeId }] },
        },
      });
      await syncTaskToGoogle(task.id); // best-effort напоминание в календаре
      created++;
    }

    if (newDoneThrough !== doneThrough) {
      // полдень, чтобы дата не съезжала ни в одной TZ
      await db.recurringTask.update({
        where: { id: r.id },
        data: { lastGeneratedAt: zonedTimeToUtc(newDoneThrough, "12:00", tz) },
      });
    }
  }
  return created;
}
