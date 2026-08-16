import { db } from "@/lib/db";
import { json, readJson, str, notFound } from "@/lib/server/http";
import { toKnowledge } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };
const KNOWLEDGE_INCLUDE = { collection: true } as const;

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const row = await db.knowledge.findUnique({ where: { id }, include: KNOWLEDGE_INCLUDE });
  if (!row) return notFound();
  await db.knowledge.update({ where: { id }, data: { lastOpenedAt: new Date() } });
  return json(toKnowledge(row));
}

// PATCH: edit title/question/keyPoints/sourceText/collection/archived.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(req);
  const exists = await db.knowledge.findUnique({ where: { id } });
  if (!exists) return notFound();

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = str(body.title, 200).trim();
  if (typeof body.question === "string") data.question = str(body.question, 2000).trim();
  if (typeof body.sourceText === "string") data.sourceText = str(body.sourceText, 20000);
  if (Array.isArray(body.keyPoints)) {
    data.keyPoints = JSON.stringify(
      body.keyPoints.map((k: unknown) => String(k).slice(0, 500)).filter(Boolean)
    );
  }
  if ("collectionId" in body) {
    data.collectionId = body.collectionId ? str(body.collectionId, 60) : null;
  }
  if (typeof body.archived === "boolean") data.archived = body.archived;

  const row = await db.knowledge.update({ where: { id }, data, include: KNOWLEDGE_INCLUDE });
  return json(toKnowledge(row));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const exists = await db.knowledge.findUnique({ where: { id } });
  if (!exists) return notFound();
  await db.knowledge.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
