import { db } from "@/lib/db";
import { review, type SrsState } from "@/lib/srs";
import { getSrsSettings } from "@/lib/server/settings";
import { recordActivity } from "@/lib/server/activity";
import { toPhrase } from "@/lib/serialize";
import { badRequest, json, notFound, readJson } from "@/lib/server/http";
import type { Rating } from "@/lib/types";

const RATINGS: Rating[] = ["again", "hard", "easy"];

export async function POST(req: Request) {
  const body = await readJson(req);
  const cardId = typeof body.cardId === "string" ? body.cardId : "";
  const rating = body.rating as Rating;
  const usedHint = !!body.usedHint;
  if (!cardId || !RATINGS.includes(rating)) return badRequest("Некорректная оценка");

  const card = await db.phraseCard.findUnique({ where: { id: cardId } });
  if (!card) return notFound("Фраза не найдена");

  const settings = await getSrsSettings();
  const state: SrsState = {
    progress: card.progress,
    stability: card.stability,
    difficulty: card.difficulty,
    reviewCount: card.reviewCount,
    successfulReviewCount: card.successfulReviewCount,
    consecutiveCorrect: card.consecutiveCorrect,
    lapseCount: card.lapseCount,
    hintCount: card.hintCount,
    lastRating: (card.lastRating as Rating | null) ?? null,
    lastReviewedAt: card.lastReviewedAt,
    dueAt: card.dueAt,
  };

  const wasNew = card.reviewCount === 0;
  const wasKnown = card.known;
  const out = review(state, rating, { usedHint, settings });

  const updated = await db.phraseCard.update({
    where: { id: cardId },
    data: {
      stability: out.stability,
      difficulty: Math.round(out.difficulty),
      retrievability: out.retrievability,
      reviewCount: out.reviewCount,
      successfulReviewCount: out.successfulReviewCount,
      consecutiveCorrect: out.consecutiveCorrect,
      lapseCount: out.lapseCount,
      hintCount: usedHint ? card.hintCount + 1 : card.hintCount,
      lastRating: out.lastRating,
      lastReviewedAt: out.lastReviewedAt,
      dueAt: out.dueAt,
      progress: out.progress,
      known: out.known,
    },
    include: { lesson: { select: { title: true } } },
  });

  await db.reviewLog.create({
    data: {
      cardId,
      rating,
      usedHint,
      prevProgress: card.progress,
      newProgress: out.progress,
      prevStability: card.stability,
      newStability: out.stability,
      intervalDays: out.intervalDays,
    },
  });

  await recordActivity({
    reviewed: 1,
    newStudied: wasNew ? 1 : 0,
    learned: out.known && !wasKnown ? 1 : 0,
  });

  return json({ card: toPhrase(updated, updated.lesson?.title), intervalDays: out.intervalDays });
}
