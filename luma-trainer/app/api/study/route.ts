import {
  buildTodayQueue,
  buildLessonQueue,
  buildFavoriteQueue,
  buildUpcomingQueue,
  buildRandomQueue,
} from "@/lib/server/queue";
import { warmPhrases } from "@/lib/server/tts";
import { getSettingsRow } from "@/lib/server/settings";
import { maybeRetryFailed } from "@/lib/server/translateWorker";
import { json } from "@/lib/server/http";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "today";
  const lessonId = url.searchParams.get("lessonId") || "";
  const filterParam = url.searchParams.get("filter");
  const filter = filterParam === "learning" || filterParam === "learned" ? filterParam : undefined;

  // Тихо добить застрявшие переводы (failed/pending), если такие есть.
  maybeRetryFailed();

  let cards;
  if (scope === "lesson" && lessonId) cards = await buildLessonQueue(lessonId, filter);
  else if (scope === "favorites") cards = await buildFavoriteQueue();
  else if (scope === "upcoming") cards = await buildUpcomingQueue();
  else if (scope === "random") cards = await buildRandomQueue();
  else cards = await buildTodayQueue();

  // Фоновый прогрев озвучки: к моменту показа карточки аудио уже в кэше.
  // Random может вернуть всю коллекцию — греем только начало очереди.
  const toWarm = scope === "random" ? cards.slice(0, 15) : cards;
  void (async () => {
    const settings = await getSettingsRow();
    await warmPhrases(toWarm.map((c) => c.english), settings.voice);
  })();

  return json({ scope, cards });
}
