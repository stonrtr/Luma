import { db } from "@/lib/db";
import { jsonArray } from "@/lib/db-mappers";
import { bad, ok, serverError } from "@/lib/server/http";

// Объединить блок со следующим по порядку. Следующий удаляется.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const block = await db.draftBlock.findUnique({ where: { id } });
    if (!block) return bad("Блок не найден", 404);
    const next = await db.draftBlock.findFirst({
      where: { draftId: block.draftId, order: { gt: block.order } },
      orderBy: { order: "asc" },
    });
    if (!next) return bad("Нет следующего блока для объединения");

    const merge = (a: string, b: string) =>
      JSON.stringify([...jsonArray(a), ...jsonArray(b)]);

    await db.draftBlock.update({
      where: { id },
      data: {
        content: [block.content, next.content].filter(Boolean).join("\n\n"),
        summary: block.summary || next.summary,
        keyPoints: merge(block.keyPoints, next.keyPoints),
        terms: merge(block.terms, next.terms),
        examples: merge(block.examples, next.examples),
        takeaways: merge(block.takeaways, next.takeaways),
        endTimestamp: next.endTimestamp ?? block.endTimestamp,
        userEdited: true,
      },
    });
    await db.draftBlock.delete({ where: { id: next.id } });
    return ok({ merged: true });
  } catch (e) {
    return serverError(e);
  }
}
