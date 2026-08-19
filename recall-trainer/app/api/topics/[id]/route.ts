import { db } from "@/lib/db";
import { bad, ok, serverError } from "@/lib/server/http";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { name?: string };
    const name = (body.name ?? "").trim();
    if (!name) return bad("Пустое название");
    await db.topic.update({ where: { id }, data: { name } });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Знания темы становятся «без темы» (onDelete: SetNull в схеме).
    await db.topic.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
