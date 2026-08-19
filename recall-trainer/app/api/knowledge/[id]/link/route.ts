import { db } from "@/lib/db";
import { bad, ok, serverError } from "@/lib/server/http";

// Связать два знания (§37). Создаём связь в обе стороны.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { toId?: string };
    const toId = body.toId;
    if (!toId || toId === id) return bad("Некорректная связь");
    await db.knowledgeLink.upsert({
      where: { fromId_toId: { fromId: id, toId } },
      create: { fromId: id, toId },
      update: {},
    });
    await db.knowledgeLink.upsert({
      where: { fromId_toId: { fromId: toId, toId: id } },
      create: { fromId: toId, toId: id },
      update: {},
    });
    return ok({ linked: true });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { toId?: string };
    const toId = body.toId;
    if (!toId) return bad("Нет цели");
    await db.knowledgeLink.deleteMany({
      where: { OR: [{ fromId: id, toId }, { fromId: toId, toId: id }] },
    });
    return ok({ unlinked: true });
  } catch (e) {
    return serverError(e);
  }
}
