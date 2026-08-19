import { db } from "@/lib/db";
import { bad, ok, serverError } from "@/lib/server/http";

// Обновить источник (напр. вставить транскрипт вручную) или удалить.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { rawContent?: string; title?: string };
    const data: Record<string, unknown> = {};
    if (typeof body.rawContent === "string") {
      data.rawContent = body.rawContent.trim();
      data.segments = null; // ручной текст без таймкодов
    }
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
    if (!Object.keys(data).length) return bad("Нет изменений");
    const s = await db.source.update({ where: { id }, data });
    return ok({ id: s.id });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.source.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
