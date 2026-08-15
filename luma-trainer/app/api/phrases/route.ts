import { db } from "@/lib/db";
import { toPhrase } from "@/lib/serialize";
import { translateCard } from "@/lib/server/translateWorker";
import { estimateDifficulty } from "@/lib/difficulty";
import { normalize } from "@/lib/lang";
import { badRequest, clampInt, json, readJson, str } from "@/lib/server/http";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lessonId");
  const favorite = url.searchParams.get("favorite") === "true";
  const sort = url.searchParams.get("sort") || "worst";

  const where: any = {};
  if (lessonId) where.lessonId = lessonId;
  if (favorite) where.favorite = true;

  const rows = await db.phraseCard.findMany({
    where,
    include: { lesson: { select: { title: true } } },
  });

  const time = (d: Date | null) => (d ? d.getTime() : 0);
  rows.sort((a, b) => {
    switch (sort) {
      case "added":
        return b.createdAt.getTime() - a.createdAt.getTime();
      case "opened":
        return time(b.lastOpenedAt) - time(a.lastOpenedAt);
      case "stale":
        return time(a.lastReviewedAt) - time(b.lastReviewedAt);
      case "hard":
        return b.difficulty - a.difficulty;
      case "easy":
        return a.difficulty - b.difficulty;
      case "lesson":
        return (a.lesson?.title || "").localeCompare(b.lesson?.title || "", "ru");
      case "alpha":
        return a.english.localeCompare(b.english, "en");
      case "worst":
      default:
        return a.progress - b.progress;
    }
  });

  return json(rows.map((r) => toPhrase(r, r.lesson?.title)));
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const lessonId = str(body.lessonId, 40);
  if (!lessonId) return badRequest("Не выбран урок");
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return badRequest("Урок не найден");

  const english = normalize(str(body.english, 400));
  const russian = normalize(str(body.russian, 400));
  if (!english && !russian) return badRequest("Введите фразу");

  const alts = Array.isArray(body.alternativeTranslations)
    ? (body.alternativeTranslations as unknown[]).filter((x) => typeof x === "string").slice(0, 4)
    : [];

  const bothSides = !!english && !!russian;
  const difficulty =
    "difficulty" in body ? clampInt(body.difficulty, 1, 10, 5) : estimateDifficulty(english);

  const source =
    body.source && typeof body.source === "object" ? body.source : { type: "manual" };

  const card = await db.phraseCard.create({
    data: {
      lessonId,
      english,
      russian,
      alternativeTranslations: JSON.stringify(alts),
      transcription: str(body.transcription, 200),
      exampleEn: normalize(str(body.exampleEn, 500)),
      exampleRu: normalize(str(body.exampleRu, 500)),
      difficulty,
      translationStatus: bothSides ? "ready" : "pending",
      dueAt: new Date(),
      source: JSON.stringify(source),
    },
    include: { lesson: { select: { title: true } } },
  });

  if (!bothSides) void translateCard(card.id);
  return json(toPhrase(card, card.lesson?.title), { status: 201 });
}
