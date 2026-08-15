import { db } from "@/lib/db";
import { toRule } from "@/lib/serialize";
import { json, notFound, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const rule = await db.grammarRule.findUnique({
    where: { id },
    include: { exercises: { orderBy: { position: "asc" } } },
  });
  if (!rule) return notFound("Правило не найдено");
  return json(toRule(rule));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(req);
  const data: Record<string, unknown> = {};
  if ("archived" in body) data.archived = !!body.archived;
  const rule = await db.grammarRule
    .update({ where: { id }, data, include: { exercises: { orderBy: { position: "asc" } } } })
    .catch(() => null);
  if (!rule) return notFound("Правило не найдено");
  return json(toRule(rule));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.grammarRule.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
}
