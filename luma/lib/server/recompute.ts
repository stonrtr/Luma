import "server-only";
import { db } from "../db";
import { LEARNED_POINTS } from "../srs";

/**
 * Синхронизировать флаг «выучено» с баллами прогресса (known ⟺ progress ≥ 100).
 * В балльной модели сам прогресс хранится в поле progress и меняется только при
 * ответе — пересчитывать его не нужно, лишь выровнять known.
 */
export async function recomputeAllProgress(): Promise<void> {
  const cards = await db.phraseCard.findMany({ select: { id: true, progress: true, known: true } });
  for (const c of cards) {
    const known = c.progress >= LEARNED_POINTS;
    if (known !== c.known) await db.phraseCard.update({ where: { id: c.id }, data: { known } });
  }
}
