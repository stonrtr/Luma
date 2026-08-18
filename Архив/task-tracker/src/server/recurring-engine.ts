import "server-only";
import { isSameDay } from "date-fns";
import { db } from "@/server/db";
import { TaskStatus } from "@/generated/prisma/client";

function isDue(
  template: {
    frequency: string;
    weekday: number | null;
    dayOfMonth: number | null;
    lastGeneratedAt: Date | null;
  },
  today: Date,
) {
  if (template.lastGeneratedAt && isSameDay(template.lastGeneratedAt, today)) {
    return false;
  }

  if (template.frequency === "DAILY") return true;

  if (template.frequency === "WEEKLY") {
    return template.weekday === today.getDay();
  }

  if (template.frequency === "MONTHLY") {
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();
    const target = Math.min(template.dayOfMonth ?? 1, lastDayOfMonth);
    return today.getDate() === target;
  }

  return false;
}

/** Creates a TODO task for every recurring template that's due today and hasn't fired yet. */
export async function generateDueRecurringTasks(assigneeId: string) {
  const templates = await db.recurringTask.findMany({
    where: { assigneeId },
  });

  const today = new Date();
  const due = templates.filter((template) => isDue(template, today));
  if (due.length === 0) return;

  const maxPosition = await db.task.aggregate({
    where: { assigneeId, status: TaskStatus.TODO },
    _max: { position: true },
  });
  let nextPosition = (maxPosition._max.position ?? -1) + 1;

  for (const template of due) {
    await db.$transaction([
      db.task.create({
        data: {
          title: template.title,
          description: template.description,
          priority: template.priority,
          status: TaskStatus.TODO,
          position: nextPosition,
          assigneeId: template.assigneeId,
          createdById: template.assigneeId,
        },
      }),
      db.recurringTask.update({
        where: { id: template.id },
        data: { lastGeneratedAt: today },
      }),
    ]);
    nextPosition += 1;
  }
}
