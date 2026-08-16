import { db } from "@/lib/db";
import { json, readJson, str, notFound } from "@/lib/server/http";
import { toCollection } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(req);
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = str(body.name, 120).trim();
  if (typeof body.position === "number") data.position = body.position;
  const exists = await db.collection.findUnique({ where: { id } });
  if (!exists) return notFound();
  const row = await db.collection.update({
    where: { id },
    data,
    include: { _count: { select: { topics: true } } },
  });
  return json(toCollection(row));
}

// Deleting a collection keeps its topics (they fall back to "Без раздела").
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const exists = await db.collection.findUnique({ where: { id } });
  if (!exists) return notFound();
  await db.collection.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
