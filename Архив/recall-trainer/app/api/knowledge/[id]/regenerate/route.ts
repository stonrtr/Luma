import { db } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/server/http";
import { toKnowledge } from "@/lib/serialize";
import { generateCard } from "@/lib/server/topicgen";
import { hasAnyLLM } from "@/lib/server/llm";

type Ctx = { params: Promise<{ id: string }> };

// Re-run the AI card generation for a topic (e.g. after editing the note, or
// after a previous failure).
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const row = await db.knowledge.findUnique({ where: { id } });
  if (!row) return notFound();
  if (!hasAnyLLM()) return serverError("LLM не настроен (нет ключа)");

  try {
    const card = await generateCard(row.sourceText, row.title || undefined);
    const updated = await db.knowledge.update({
      where: { id },
      data: {
        title: card.title || row.title,
        question: card.question,
        keyPoints: JSON.stringify(card.keyPoints),
        genStatus: "ready",
        genError: "",
      },
      include: { collection: true },
    });
    return json(toKnowledge(updated));
  } catch (e) {
    const updated = await db.knowledge.update({
      where: { id },
      data: { genStatus: "failed", genError: (e as Error).message.slice(0, 500) },
      include: { collection: true },
    });
    return json(toKnowledge(updated), { status: 200 });
  }
}
