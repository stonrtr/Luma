import "server-only";
import { db } from "@/server/db";

export function getRecurringTasks(assigneeId: string) {
  return db.recurringTask.findMany({
    where: { assigneeId },
    orderBy: { createdAt: "asc" },
  });
}
