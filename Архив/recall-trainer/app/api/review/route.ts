import { db } from "@/lib/db";
import { json, readJson, badRequest, notFound } from "@/lib/server/http";
import { toKnowledge } from "@/lib/serialize";
import { review, type SrsState } from "@/lib/srs";
import { getSrsSettings } from "@/lib/server/settings";
import { recordActivity } from "@/lib/server/activity";
import type { Rating } from "@/lib/types";

const RATINGS: Rating[] = ["again", "hard", "easy"];

// POST /api/review  { knowledgeId, rating, usedHint? }
// Applies one spaced-repetition review to a topic and reschedules it.
export async function POST(req: Request) {
  const body = await readJson(req);
  const knowledgeId = typeof body.knowledgeId === "string" ? body.knowledgeId : "";
  const rating = body.rating as Rating;
  const usedHint = body.usedHint === true;
  if (!knowledgeId || !RATINGS.includes(rating)) return badRequest("Некорректный запрос");

  const row = await db.knowledge.findUnique({ where: { id: knowledgeId } });
  if (!row) return notFound();

  const settings = await getSrsSettings();
  const wasNew = row.reviewCount === 0;
  const wasKnown = row.known;

  const state: SrsState = {
    stability: row.stability,
    difficulty: row.difficulty,
    reviewCount: row.reviewCount,
    successfulReviewCount: row.successfulReviewCount,
    consecutiveCorrect: row.consecutiveCorrect,
    lapseCount: row.lapseCount,
    hintCount: row.hintCount,
    lastRating: (row.lastRating as Rating) ?? null,
    lastReviewedAt: row.lastReviewedAt,
    dueAt: row.dueAt,
  };

  const out = review(state, rating, { usedHint, settings });

  const updated = await db.knowledge.update({
    where: { id: knowledgeId },
    data: {
      stability: out.stability,
      difficulty: out.difficulty,
      retrievability: out.retrievability,
      reviewCount: out.reviewCount,
      successfulReviewCount: out.successfulReviewCount,
      consecutiveCorrect: out.consecutiveCorrect,
      lapseCount: out.lapseCount,
      hintCount: usedHint ? row.hintCount + 1 : row.hintCount,
      lastRating: out.lastRating,
      lastReviewedAt: out.lastReviewedAt,
      dueAt: out.dueAt,
      progress: out.progress,
      known: out.known,
    },
    include: { collection: true },
  });

  await db.reviewLog.create({
    data: {
      knowledgeId,
      rating,
      usedHint,
      prevProgress: row.progress,
      newProgress: out.progress,
      intervalDays: out.intervalDays,
    },
  });

  await recordActivity({
    reviewed: 1,
    newStudied: wasNew ? 1 : 0,
    learned: !wasKnown && out.known ? 1 : 0,
  });

  return json({ card: toKnowledge(updated), intervalDays: out.intervalDays });
}
