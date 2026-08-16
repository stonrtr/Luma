import "server-only";
import { db } from "@/server/db";
import { weekStartInTz, addDays } from "@/lib/week";
import { zonedWeekday } from "@/lib/tz";

// Победы недели. Текущую заполняем только с пятницы; прошлую можно дозаполнить позже (в архиве).
// Неделя и «сегодня» — в часовом поясе самого сотрудника.
export async function getWeeklyWins(userId: string) {
  const now = new Date();
  const tz = (await db.user.findUnique({ where: { id: userId }, select: { timezone: true } }))?.timezone || "Europe/Kyiv";
  const currentMon = weekStartInTz(tz, now);
  const prevMon = weekStartInTz(tz, addDays(now, -7));
  const dow = zonedWeekday(now, tz) - 1; // Пн=0 … Вс=6 в TZ пользователя
  const canRecord = dow >= 4; // Пт(4)/Сб/Вс — можно фиксировать текущую

  const rows = await db.weeklyWin.findMany({ where: { userId }, orderBy: { weekStart: "desc" } });
  const byWeek = new Map(rows.map((r) => [r.weekStart.getTime(), r.text]));
  const current = byWeek.get(currentMon.getTime()) ?? "";

  // архив: все заполненные недели + прошлая неделя всегда (её можно заполнить позже)
  const weeks = new Set<number>();
  for (const r of rows) if (r.text.trim()) weeks.add(r.weekStart.getTime());
  weeks.add(prevMon.getTime());
  if (!current.trim()) weeks.delete(currentMon.getTime()); // пустую текущую держим только в форме сверху

  const archive = [...weeks]
    .sort((a, b) => b - a)
    .map((ts) => ({ weekStart: new Date(ts).toISOString(), text: byWeek.get(ts) ?? "" }));

  return { weekStart: currentMon.toISOString(), current, filled: current.trim().length > 0, canRecord, archive };
}
