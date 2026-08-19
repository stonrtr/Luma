import { db } from "@/lib/db";
import { jsonArray } from "@/lib/db-mappers";
import { bad, ok, serverError } from "@/lib/server/http";

// Разделить блок на два. Тезисы с индекса keyPointIndex уходят в новый блок.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { keyPointIndex?: number };
    const block = await db.draftBlock.findUnique({ where: { id } });
    if (!block) return bad("Блок не найден", 404);

    const kp = jsonArray(block.keyPoints);
    const idx = Math.min(Math.max(1, body.keyPointIndex ?? Math.ceil(kp.length / 2)), Math.max(1, kp.length - 1));
    const first = kp.slice(0, idx);
    const second = kp.slice(idx);

    // Сдвигаем order у последующих блоков, чтобы вставить новый сразу за текущим.
    await db.draftBlock.updateMany({
      where: { draftId: block.draftId, order: { gt: block.order } },
      data: { order: { increment: 1 } },
    });

    await db.draftBlock.update({
      where: { id },
      data: { keyPoints: JSON.stringify(first), userEdited: true },
    });
    const created = await db.draftBlock.create({
      data: {
        draftId: block.draftId,
        title: `${block.title} (часть 2)`,
        summary: "",
        content: "",
        keyPoints: JSON.stringify(second),
        terms: block.terms,
        examples: "[]",
        takeaways: "[]",
        startTimestamp: block.endTimestamp,
        endTimestamp: block.endTimestamp,
        suggestedTopic: block.suggestedTopic,
        topicId: block.topicId,
        order: block.order + 1,
        userEdited: true,
      },
    });
    return ok({ newBlockId: created.id });
  } catch (e) {
    return serverError(e);
  }
}
