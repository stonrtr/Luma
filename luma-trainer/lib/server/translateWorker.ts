import "server-only";
import { db } from "../db";
import { hasAnyLLM } from "./llm";
import { translatePhrase } from "./translate";
import { synthesize, hasAnyTts } from "./tts";
import { getSettingsRow } from "./settings";
import { detectLanguage } from "../lang";
import { estimateDifficulty } from "../difficulty";

/** Прогреть дисковый кэш озвучки для фразы (fire-and-forget). */
function warmTts(english: string): void {
  if (!english || !hasAnyTts()) return;
  void (async () => {
    try {
      const settings = await getSettingsRow();
      await synthesize(english, settings.voice);
    } catch {
      /* прогрев — best effort */
    }
  })();
}

/** Translate a single pending card. Failure marks it "failed" — never loses the card (§16.2). */
export async function translateCard(id: string): Promise<boolean> {
  const card = await db.phraseCard.findUnique({ where: { id } });
  if (!card) return false;

  const srcLang: "en" | "ru" = card.english
    ? "en"
    : card.russian
      ? "ru"
      : detectLanguage(card.english || card.russian || "");

  if (!hasAnyLLM()) {
    // No provider: if the card already has both sides, it's fine; otherwise leave failed.
    if (card.english && card.russian) {
      await db.phraseCard.update({ where: { id }, data: { translationStatus: "ready" } });
      warmTts(card.english);
      return true;
    }
    await db.phraseCard.update({ where: { id }, data: { translationStatus: "failed" } });
    return false;
  }

  try {
    const result = await translatePhrase({
      english: card.english || undefined,
      russian: card.russian || undefined,
      sourceLanguage: srcLang,
    });
    const primary = result.translations[0] || card.russian;
    const english = card.english || result.english;
    await db.phraseCard.update({
      where: { id },
      data: {
        english: english || card.english,
        russian: card.russian || primary,
        alternativeTranslations: JSON.stringify(
          (card.russian ? result.translations : result.translations.slice(1)).slice(0, 4)
        ),
        transcription: card.transcription || result.transcription,
        exampleEn: card.exampleEn || result.exampleEn,
        exampleRu: card.exampleRu || result.exampleRu,
        difficulty: result.difficulty || estimateDifficulty(english),
        translationStatus: "ready",
      },
    });
    warmTts(english || card.english);
    return true;
  } catch {
    await db.phraseCard.update({ where: { id }, data: { translationStatus: "failed" } });
    return false;
  }
}

// --- Авто-ретрай застрявших переводов ------------------------------------
// Перевод может временно упасть (429 по квоте, таймаут холодного старта) и
// карточка застревает в "failed". Чтобы чинилось само, самые частые чтения
// (очередь «Сегодня», список «Фразы») тихо в фоне добивают такие карточки.
// Троттлинг не даёт долбить LLM на каждом запросе.
const RETRY_THROTTLE_MS = 60_000;
let lastRetryAt = 0;
let retryRunning = false;

/** Fire-and-forget: если есть failed/pending карточки — добить их (с троттлингом). */
export function maybeRetryFailed(): void {
  if (retryRunning) return;
  const now = Date.now();
  if (now - lastRetryAt < RETRY_THROTTLE_MS) return;
  lastRetryAt = now;
  if (!hasAnyLLM()) return;
  retryRunning = true;
  void (async () => {
    try {
      const stuck = await db.phraseCard.count({
        where: { translationStatus: { in: ["pending", "failed"] } },
      });
      if (stuck > 0) await translatePendingBatch();
    } catch {
      /* авто-ретрай — best effort */
    } finally {
      retryRunning = false;
    }
  })();
}

/** Process pending/failed cards sequentially (kind to rate limits). Returns how many succeeded. */
export async function translatePendingBatch(limit = 50): Promise<number> {
  const pending = await db.phraseCard.findMany({
    where: { translationStatus: { in: ["pending", "failed"] } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let ok = 0;
  for (const c of pending) {
    if (await translateCard(c.id)) ok += 1;
  }
  return ok;
}
