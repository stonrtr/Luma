import { db } from "@/lib/db";
import { jsonArray } from "@/lib/db-mappers";
import { gradeAnswer } from "@/lib/server/ai-features";
import { bad, ok, serverError } from "@/lib/server/http";
import { hasAnyLLM } from "@/lib/server/llm";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!hasAnyLLM()) return bad("AI не настроен (нет ключа)", 503);
    const body = (await req.json()) as {
      question?: string;
      knowledgeId?: string | null;
      answer?: string;
    };
    const question = (body.question ?? "").trim();
    const answer = (body.answer ?? "").trim();
    if (!question || !answer) return bad("Нужны вопрос и ответ");

    let reference = "";
    if (body.knowledgeId) {
      const k = await db.knowledge.findUnique({ where: { id: body.knowledgeId } });
      if (k) reference = [k.content, jsonArray(k.keyPoints).join("; ")].filter(Boolean).join(" — ");
    }
    const result = await gradeAnswer(question, reference, answer);
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
