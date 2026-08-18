import { db } from "@/lib/db";
import { json, readJson, str } from "@/lib/server/http";
import { toCollection } from "@/lib/serialize";

export async function GET() {
  const rows = await db.collection.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { topics: true } } },
  });
  return json(rows.map(toCollection));
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const name = str(body.name, 120).trim();
  if (!name) return json({ error: "Название обязательно" }, { status: 400 });
  const count = await db.collection.count();
  const row = await db.collection.create({
    data: { name, position: count },
    include: { _count: { select: { topics: true } } },
  });
  return json(toCollection(row), { status: 201 });
}
