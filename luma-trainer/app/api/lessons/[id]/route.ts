import { db } from "@/lib/db";
import { toLesson, toPhrase } from "@/lib/serialize";
import { json, notFound, readJson, str } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: {
      topic: { select: { name: true } },
      phrases: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!lesson) return notFound("Урок не найден");
  // mark opened
  await db.lesson.update({ where: { id }, data: { lastOpenedAt: new Date() } });
  return json({
    lesson: toLesson(lesson),
    phrases: lesson.phrases.map((p) => toPhrase(p, lesson.title)),
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(req);
  const data: Record<string, unknown> = {};
  if ("title" in body) {
    const title = str(body.title, 160).trim();
    if (title) data.title = title;
  }
  if ("topicId" in body) data.topicId = body.topicId ? str(body.topicId, 40) : null;
  if ("archived" in body) data.archived = !!body.archived;
  if ("touch" in body) data.lastOpenedAt = new Date();

  const lesson = await db.lesson
    .update({
      where: { id },
      data,
      include: { topic: { select: { name: true } }, phrases: true },
    })
    .catch(() => null);
  if (!lesson) return notFound("Урок не найден");
  return json(toLesson(lesson));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.lesson.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
}
