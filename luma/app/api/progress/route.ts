import { db } from "@/lib/db";
import { localDayKey, lastNDays } from "@/lib/date";
import { json } from "@/lib/server/http";

export async function GET() {
  const now = Date.now();
  const cards = await db.phraseCard.findMany({
    select: { progress: true, known: true, reviewCount: true, dueAt: true, translationStatus: true },
  });

  const ready = cards.filter((c) => c.translationStatus === "ready");
  const active = ready.filter((c) => !c.known).length;
  const attention = ready.filter(
    (c) => !c.known && ((c.dueAt && new Date(c.dueAt).getTime() <= now) || c.progress < 40)
  ).length;

  // Progress distribution buckets.
  const distribution = [0, 0, 0, 0, 0]; // 0-24, 25-49, 50-74, 75-99, 100
  for (const c of ready) {
    const p = c.progress;
    if (p >= 100) distribution[4]++;
    else if (p >= 75) distribution[3]++;
    else if (p >= 50) distribution[2]++;
    else if (p >= 25) distribution[1]++;
    else distribution[0]++;
  }

  // Activity buckets.
  const weekKeys = lastNDays(7);
  const monthKeys = lastNDays(30);
  const rows = await db.dailyActivity.findMany({ where: { date: { in: monthKeys } } });
  const byDate = new Map(rows.map((r) => [r.date, r]));

  const today = byDate.get(localDayKey());
  const learnedWeek = weekKeys.reduce((s, k) => s + (byDate.get(k)?.learned ?? 0), 0);
  const learnedMonth = monthKeys.reduce((s, k) => s + (byDate.get(k)?.learned ?? 0), 0);

  const activity7 = weekKeys.map((k) => ({
    date: k,
    reviewed: byDate.get(k)?.reviewed ?? 0,
    newStudied: byDate.get(k)?.newStudied ?? 0,
  }));

  return json({
    reviewedToday: today?.reviewed ?? 0,
    newToday: today?.newStudied ?? 0,
    learnedToday: today?.learned ?? 0,
    learnedWeek,
    learnedMonth,
    activePhrases: active,
    attention,
    totalPhrases: cards.length,
    learnedTotal: ready.filter((c) => c.known).length,
    distribution,
    activity7,
  });
}
