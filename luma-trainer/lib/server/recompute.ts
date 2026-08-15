import "server-only";
import { db } from "../db";
import { computeProgress, type SrsSettings } from "../srs";
import type { Rating } from "../types";

/** Recompute progress/known for every phrase after study-settings change (§9.4). */
export async function recomputeAllProgress(settings: SrsSettings): Promise<void> {
  const cards = await db.phraseCard.findMany();
  for (const c of cards) {
    const { progress, known } = computeProgress(
      {
        reviewCount: c.reviewCount,
        successfulReviewCount: c.successfulReviewCount,
        consecutiveCorrect: c.consecutiveCorrect,
        stability: c.stability,
        lapseCount: c.lapseCount,
        hintCount: c.hintCount,
        lastRating: (c.lastRating as Rating | null) ?? null,
      },
      settings
    );
    if (progress !== c.progress || known !== c.known) {
      await db.phraseCard.update({ where: { id: c.id }, data: { progress, known } });
    }
  }
}
