import "server-only";
import { db } from "../db";
import { localDayKey } from "../date";

/** Increment today's activity counters (§21). */
export async function recordActivity(delta: {
  reviewed?: number;
  newStudied?: number;
  learned?: number;
}) {
  const date = localDayKey();
  const row = await db.dailyActivity.findUnique({ where: { date } });
  if (!row) {
    await db.dailyActivity.create({
      data: {
        date,
        reviewed: delta.reviewed ?? 0,
        newStudied: delta.newStudied ?? 0,
        learned: delta.learned ?? 0,
      },
    });
    return;
  }
  await db.dailyActivity.update({
    where: { date },
    data: {
      reviewed: row.reviewed + (delta.reviewed ?? 0),
      newStudied: row.newStudied + (delta.newStudied ?? 0),
      learned: row.learned + (delta.learned ?? 0),
    },
  });
}
