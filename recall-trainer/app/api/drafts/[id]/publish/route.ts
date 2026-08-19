import { db } from "@/lib/db";
import { jsonArray } from "@/lib/db-mappers";
import { embed } from "@/lib/server/embed";
import { bad, ok, serverError } from "@/lib/server/http";
import { knowledgeEmbedText, resolveTopicPath } from "@/lib/server/topics";

export const maxDuration = 120;

// Сохранить выбранные блоки как знания (§11). Возвращает число сохранённых.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const draft = await db.draft.findUnique({
      where: { id },
      include: { blocks: { orderBy: { order: "asc" } }, source: true },
    });
    if (!draft) return bad("Черновик не найден", 404);

    const selected = draft.blocks.filter((b) => b.selected);
    if (!selected.length) return bad("Не выбрано ни одного блока");

    const createdIds: string[] = [];
    for (const b of selected) {
      const topicId = b.topicId ?? (await resolveTopicPath(b.suggestedTopic));
      const keyPoints = jsonArray(b.keyPoints);
      const content = b.content || b.summary;
      const emb = await embed(knowledgeEmbedText({ title: b.title, content, keyPoints }));
      const k = await db.knowledge.create({
        data: {
          title: b.title,
          content,
          keyPoints: JSON.stringify(keyPoints),
          topicId,
          sourceId: draft.sourceId,
          sourceStart: b.startTimestamp,
          sourceEnd: b.endTimestamp,
          importance: 2,
          embedding: emb ? JSON.stringify(emb) : null,
        },
      });
      createdIds.push(k.id);
    }

    await db.draft.update({ where: { id }, data: { status: "PUBLISHED" } });
    await db.source.update({ where: { id: draft.sourceId }, data: { status: "COMPLETED" } });

    // Учёт активности.
    const day = new Date().toISOString().slice(0, 10);
    await db.dailyActivity.upsert({
      where: { day },
      create: { day, created: createdIds.length },
      update: { created: { increment: createdIds.length } },
    });

    return ok({ count: createdIds.length, ids: createdIds });
  } catch (e) {
    return serverError(e);
  }
}
