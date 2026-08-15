import { db } from "@/lib/db";
import { parseImport } from "@/lib/importParser";
import { estimateDifficulty } from "@/lib/difficulty";
import { translatePendingBatch } from "@/lib/server/translateWorker";
import { badRequest, json, readJson, str } from "@/lib/server/http";

const MAX_LINES = 2000; // §28 bounded import size

export async function POST(req: Request) {
  const body = await readJson(req);
  const text = str(body.text, 500000);
  if (!text.trim()) return badRequest("Пустой список");

  // Resolve target lesson.
  let lessonId = str(body.lessonId, 40);
  if (!lessonId) {
    const title = str(body.newLessonTitle, 160).trim();
    if (!title) return badRequest("Не выбран урок");
    let topicId: string | null = null;
    const newTopicName = str(body.newTopicName, 120).trim();
    if (newTopicName) {
      const count = await db.topic.count();
      const topic = await db.topic.create({ data: { name: newTopicName, position: count } });
      topicId = topic.id;
    } else if (body.topicId && typeof body.topicId === "string") {
      topicId = body.topicId;
    }
    const lesson = await db.lesson.create({ data: { title, topicId } });
    lessonId = lesson.id;
  } else {
    const exists = await db.lesson.findUnique({ where: { id: lessonId } });
    if (!exists) return badRequest("Урок не найден");
  }

  const { entries } = parseImport(text);
  const limited = entries.slice(0, MAX_LINES);

  const now = new Date();
  let saved = 0;
  let ready = 0;
  let pending = 0;

  // Save every valid row immediately; a translation error must never drop a row (§16.2).
  for (const e of limited) {
    const bothSides = !!e.english && !!e.russian;
    try {
      await db.phraseCard.create({
        data: {
          lessonId,
          english: e.english,
          russian: e.russian,
          difficulty: estimateDifficulty(e.english),
          translationStatus: bothSides ? "ready" : "pending",
          dueAt: now,
          source: JSON.stringify({ type: "import" }),
        },
      });
      saved += 1;
      if (bothSides) ready += 1;
      else pending += 1;
    } catch {
      // skip malformed row, keep going
    }
  }

  // Kick off background translation (fire-and-forget; import already committed).
  if (pending > 0) void translatePendingBatch();

  return json({
    lessonId,
    saved,
    translated: ready,
    pending,
    errors: limited.length - saved,
    skipped: entries.length - limited.length,
  });
}
