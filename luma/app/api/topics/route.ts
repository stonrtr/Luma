import { db } from "@/lib/db";
import { toTopic } from "@/lib/serialize";
import { badRequest, json, readJson, str } from "@/lib/server/http";

export async function GET() {
  const topics = await db.topic.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { lessons: true } } },
  });
  return json(topics.map(toTopic));
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const name = str(body.name, 120).trim();
  if (!name) return badRequest("Название темы обязательно");
  const count = await db.topic.count();
  const topic = await db.topic.create({ data: { name, position: count } });
  return json(toTopic({ ...topic, _count: { lessons: 0 } }), { status: 201 });
}
