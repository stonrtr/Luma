import { db } from "@/lib/db";
import { toPhrase } from "@/lib/serialize";
import { normalize } from "@/lib/lang";
import { clampInt, json, notFound, readJson, str } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const card = await db.phraseCard.findUnique({
    where: { id },
    include: { lesson: { select: { title: true } } },
  });
  if (!card) return notFound("Фраза не найдена");
  return json(toPhrase(card, card.lesson?.title));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(req);
  const data: Record<string, unknown> = {};

  if ("english" in body) data.english = normalize(str(body.english, 400));
  if ("russian" in body) data.russian = normalize(str(body.russian, 400));
  if ("transcription" in body) data.transcription = str(body.transcription, 200);
  if ("exampleEn" in body) data.exampleEn = normalize(str(body.exampleEn, 500));
  if ("exampleRu" in body) data.exampleRu = normalize(str(body.exampleRu, 500));
  if ("difficulty" in body) data.difficulty = clampInt(body.difficulty, 1, 10, 5);
  if ("favorite" in body) data.favorite = !!body.favorite;
  if ("lessonId" in body && typeof body.lessonId === "string") data.lessonId = body.lessonId;
  if ("touch" in body) data.lastOpenedAt = new Date();
  if (Array.isArray(body.alternativeTranslations)) {
    data.alternativeTranslations = JSON.stringify(
      (body.alternativeTranslations as unknown[]).filter((x) => typeof x === "string").slice(0, 4)
    );
  }

  const card = await db.phraseCard
    .update({ where: { id }, data, include: { lesson: { select: { title: true } } } })
    .catch(() => null);
  if (!card) return notFound("Фраза не найдена");
  return json(toPhrase(card, card.lesson?.title));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.phraseCard.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
}
