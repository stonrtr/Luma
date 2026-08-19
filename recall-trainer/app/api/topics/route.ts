import { db } from "@/lib/db";
import { bad, ok, serverError } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; parentId?: string | null };
    const name = (body.name ?? "").trim();
    if (!name) return bad("Пустое название");
    const t = await db.topic.create({ data: { name, parentId: body.parentId ?? null } });
    return ok({ id: t.id });
  } catch (e) {
    return serverError(e);
  }
}
