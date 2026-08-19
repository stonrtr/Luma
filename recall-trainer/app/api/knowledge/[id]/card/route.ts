import { db } from "@/lib/db";
import { jsonArray } from "@/lib/db-mappers";
import { generateCard } from "@/lib/server/ai-features";
import { bad, ok, serverError } from "@/lib/server/http";

export const maxDuration = 60;

// Создать/обновить карточку повторения для знания (§25, §26).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      question?: string;
      answer?: string;
    };
    const k = await db.knowledge.findUnique({ where: { id } });
    if (!k) return bad("Знание не найдено", 404);

    let question = (body.question ?? "").trim();
    let answer = (body.answer ?? "").trim();
    if (!question || !answer) {
      const gen = await generateCard(k.title, k.content, jsonArray(k.keyPoints));
      question = question || gen.question;
      answer = answer || gen.answer;
    }

    const card = await db.card.upsert({
      where: { knowledgeId: id },
      create: { knowledgeId: id, question, answer, dueAt: new Date() },
      update: { question, answer },
    });
    return ok({ cardId: card.id, question, answer });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.card.deleteMany({ where: { knowledgeId: id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
