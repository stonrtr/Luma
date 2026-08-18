import { db } from "@/lib/db";
import { json } from "@/lib/server/http";
import { lastNDays, localDayKey } from "@/lib/date";
import type { ProgressData } from "@/lib/types";

export async function GET() {
  const now = new Date();
  const [all, activities] = await Promise.all([
    db.knowledge.findMany({
      where: { archived: false },
      select: { progress: true, known: true, dueAt: true, reviewCount: true },
    }),
    db.dailyActivity.findMany(),
  ]);

  const totalTopics = all.length;
  let learnedTotal = 0;
  let dueNow = 0;
  const distribution = [0, 0, 0, 0, 0]; // 0-20,20-40,40-60,60-80,80-100
  for (const k of all) {
    if (k.known) learnedTotal += 1;
    if (k.reviewCount > 0 && k.dueAt && k.dueAt.getTime() <= now.getTime()) dueNow += 1;
    const b = Math.min(4, Math.floor(k.progress / 20));
    distribution[b] += 1;
  }

  const byDate = new Map(activities.map((a) => [a.date, a]));
  const days7 = lastNDays(7, now);
  const activity7 = days7.map((date) => {
    const a = byDate.get(date);
    return { date, reviewed: a?.reviewed ?? 0, newStudied: a?.newStudied ?? 0 };
  });

  const todayKey = localDayKey(now);
  const todayRow = byDate.get(todayKey);

  const days7Keys = new Set(days7);
  let learnedWeek = 0;
  for (const a of activities) if (days7Keys.has(a.date)) learnedWeek += a.learned;

  // Current streak: consecutive days (ending today) with any reviews.
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const a = byDate.get(localDayKey(d));
    if (a && a.reviewed > 0) streak += 1;
    else break;
  }

  const data: ProgressData = {
    totalTopics,
    learnedTotal,
    learningTotal: totalTopics - learnedTotal,
    dueNow,
    reviewedToday: todayRow?.reviewed ?? 0,
    newToday: todayRow?.newStudied ?? 0,
    learnedToday: todayRow?.learned ?? 0,
    learnedWeek,
    distribution,
    activity7,
    streak,
  };
  return json(data);
}
