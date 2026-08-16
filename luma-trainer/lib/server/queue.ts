import "server-only";
import { db } from "../db";
import { getSettingsRow } from "./settings";
import { recordActivity } from "./activity";
import { localDayKey } from "../date";
import { toPhrase } from "../serialize";
import type { PhraseCard } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Priority within the "due" phase (§5.2): most overdue → lowest progress →
// last answer "again" → longest since review.
function dueComparator(a: any, b: any): number {
  const now = Date.now();
  const overdueA = a.dueAt ? now - new Date(a.dueAt).getTime() : 0;
  const overdueB = b.dueAt ? now - new Date(b.dueAt).getTime() : 0;
  if (overdueA !== overdueB) return overdueB - overdueA;
  if (a.progress !== b.progress) return a.progress - b.progress;
  const againA = a.lastRating === "again" ? 0 : 1;
  const againB = b.lastRating === "again" ? 0 : 1;
  if (againA !== againB) return againA - againB;
  const revA = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
  const revB = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
  return revA - revB;
}

/** The "Today" review queue (§5.2). Only phrases with a ready translation qualify. */
export async function buildTodayQueue(): Promise<PhraseCard[]> {
  const settings = await getSettingsRow();
  const now = new Date();

  const today = await db.dailyActivity.findUnique({ where: { date: localDayKey() } });
  const newStudiedToday = today?.newStudied ?? 0;
  const newLimit = Math.max(0, settings.newCardsPerDay - newStudiedToday);

  const ready = await db.phraseCard.findMany({
    where: { translationStatus: "ready", lesson: { archived: false } },
    include: { lesson: { select: { title: true } } },
  });

  const due = ready
    .filter((c) => c.reviewCount > 0 && c.dueAt && c.dueAt.getTime() <= now.getTime())
    .sort(dueComparator);

  const fresh = ready
    .filter((c) => c.reviewCount === 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, newLimit);

  // Освежение выученных (п.3): подмешиваем ~REFRESH_COUNT самых «залежавшихся»
  // выученных слов, ещё не наступивших по расписанию и не повторявшихся сегодня.
  // Так база не копит тихо забытое, но и не заваливает одними и теми же словами.
  const REFRESH_COUNT = 5;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const refresh = settings.refreshLearned
    ? ready
        .filter(
          (c) =>
            c.known &&
            c.dueAt &&
            c.dueAt.getTime() > now.getTime() && // ещё не «пора» — берём чуть раньше срока
            (!c.lastReviewedAt || c.lastReviewedAt.getTime() < startOfToday.getTime())
        )
        .sort((a, b) => (a.lastReviewedAt?.getTime() ?? 0) - (b.lastReviewedAt?.getTime() ?? 0))
        .slice(0, REFRESH_COUNT)
    : [];

  const combined = [...due, ...refresh, ...fresh].slice(0, settings.cardsPerDay);
  return combined.map((c) => toPhrase(c, c.lesson?.title));
}

/** Study a whole lesson regardless of schedule (§11.2). Worst-known first. */
export async function buildLessonQueue(lessonId: string): Promise<PhraseCard[]> {
  const cards = await db.phraseCard.findMany({
    where: { lessonId, translationStatus: "ready" },
    include: { lesson: { select: { title: true } } },
  });
  cards.sort((a, b) => a.progress - b.progress || a.createdAt.getTime() - b.createdAt.getTime());
  await db.lesson.update({ where: { id: lessonId }, data: { lastOpenedAt: new Date() } }).catch(() => {});
  return cards.map((c) => toPhrase(c, c.lesson?.title));
}

/**
 * «Приближающиеся к забыванию»: уже изученные карточки, у которых срок
 * повторения ещё не наступил, отсортированные по близости dueAt — для
 * дополнительного занятия, когда очередь «Сегодня» пуста.
 */
export async function buildUpcomingQueue(): Promise<PhraseCard[]> {
  const settings = await getSettingsRow();
  const cards = await db.phraseCard.findMany({
    where: {
      translationStatus: "ready",
      lesson: { archived: false },
      reviewCount: { gt: 0 },
      dueAt: { gt: new Date() },
    },
    include: { lesson: { select: { title: true } } },
    orderBy: { dueAt: "asc" },
    take: settings.cardsPerDay,
  });
  return cards.map((c) => toPhrase(c, c.lesson?.title));
}

/** Режим Random: абсолютно все готовые фразы в случайном порядке.
 *  Клиент по исчерпании списка запрашивает новую перетасовку — цикл бесконечен. */
export async function buildRandomQueue(): Promise<PhraseCard[]> {
  const cards = await db.phraseCard.findMany({
    where: { translationStatus: "ready", lesson: { archived: false } },
    include: { lesson: { select: { title: true } } },
  });
  // Fisher–Yates
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.map((c) => toPhrase(c, c.lesson?.title));
}

/** Favorites as a virtual study set (§14). Worst-known first. */
export async function buildFavoriteQueue(): Promise<PhraseCard[]> {
  const cards = await db.phraseCard.findMany({
    where: { favorite: true, translationStatus: "ready" },
    include: { lesson: { select: { title: true } } },
  });
  cards.sort((a, b) => a.progress - b.progress);
  return cards.map((c) => toPhrase(c, c.lesson?.title));
}

export { recordActivity };
