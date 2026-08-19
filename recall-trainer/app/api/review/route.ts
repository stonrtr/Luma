import { db } from "@/lib/db";
import { bad, ok, serverError } from "@/lib/server/http";
import { review, type Rating, type SrsState } from "@/lib/srs";

const RATINGS: Rating[] = ["again", "hard", "easy"];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { cardId?: string; rating?: string };
    if (!RATINGS.includes(body.rating as Rating)) return bad("Неверная оценка");
    const card = await db.card.findUnique({ where: { id: body.cardId } });
    if (!card) return bad("Карточка не найдена", 404);

    const state: SrsState = {
      progress: card.progress,
      stability: card.stability,
      difficulty: card.difficulty,
      reviewCount: card.reviewCount,
      successfulReviewCount: card.successfulReviewCount,
      consecutiveCorrect: card.consecutiveCorrect,
      lapseCount: card.lapseCount,
      lastRating: card.lastRating as Rating | null,
      lastReviewedAt: card.lastReviewedAt,
      dueAt: card.dueAt,
    };
    const out = review(state, body.rating as Rating);

    await db.card.update({
      where: { id: card.id },
      data: {
        progress: out.progress,
        stability: out.stability,
        difficulty: out.difficulty,
        reviewCount: out.reviewCount,
        successfulReviewCount: out.successfulReviewCount,
        consecutiveCorrect: out.consecutiveCorrect,
        lapseCount: out.lapseCount,
        lastRating: out.lastRating,
        lastReviewedAt: out.lastReviewedAt,
        dueAt: out.dueAt,
      },
    });
    await db.knowledge.update({
      where: { id: card.knowledgeId },
      data: { lastReviewedAt: out.lastReviewedAt },
    });
    await db.reviewLog.create({
      data: { cardId: card.id, rating: out.lastRating, intervalDays: out.intervalDays },
    });

    const day = new Date().toISOString().slice(0, 10);
    await db.dailyActivity.upsert({
      where: { day },
      create: { day, reviewed: 1 },
      update: { reviewed: { increment: 1 } },
    });

    return ok({ dueAt: out.dueAt.toISOString(), progress: out.progress, known: out.known });
  } catch (e) {
    return serverError(e);
  }
}
