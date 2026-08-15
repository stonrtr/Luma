import { buildTodayQueue, buildLessonQueue, buildFavoriteQueue } from "@/lib/server/queue";
import { warmPhrases } from "@/lib/server/tts";
import { getSettingsRow } from "@/lib/server/settings";
import { json } from "@/lib/server/http";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "today";
  const lessonId = url.searchParams.get("lessonId") || "";

  let cards;
  if (scope === "lesson" && lessonId) cards = await buildLessonQueue(lessonId);
  else if (scope === "favorites") cards = await buildFavoriteQueue();
  else cards = await buildTodayQueue();

  // Фоновый прогрев озвучки всей очереди: к моменту показа карточки аудио уже в кэше.
  void (async () => {
    const settings = await getSettingsRow();
    await warmPhrases(cards.map((c) => c.english), settings.voice);
  })();

  return json({ scope, cards });
}
