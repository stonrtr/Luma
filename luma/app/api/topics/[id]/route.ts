import { db } from "@/lib/db";
import { toTopic } from "@/lib/serialize";
import { badRequest, json, notFound, readJson, str } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(req);
  const name = str(body.name, 120).trim();
  if (!name) return badRequest("Название темы обязательно");
  const topic = await db.topic
    .update({ where: { id }, data: { name }, include: { _count: { select: { lessons: true } } } })
    .catch(() => null);
  if (!topic) return notFound("Тема не найдена");
  return json(toTopic(topic));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const count = await db.lesson.count({ where: { topicId: id } });
  if (count > 0) return badRequest("Нельзя удалить непустую тему");
  await db.topic.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
}
