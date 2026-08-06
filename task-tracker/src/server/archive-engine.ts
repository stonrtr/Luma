import "server-only";
import { db } from "@/server/db";
import { TaskStatus } from "@/generated/prisma/client";

const ARCHIVE_AFTER_DAYS = 7;

/** Moves DONE tasks older than 7 days (since completion) into the hidden archive. */
export async function archiveOldDoneTasks(assigneeId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ARCHIVE_AFTER_DAYS);

  await db.task.updateMany({
    where: {
      assigneeId,
      status: TaskStatus.DONE,
      archivedAt: null,
      completedAt: { lte: cutoff },
    },
    data: { archivedAt: new Date() },
  });
}
