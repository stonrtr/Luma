import { db } from "@/lib/db";
import { jsonArray } from "@/lib/db-mappers";
import { generateQuiz, type AskContext } from "@/lib/server/ai-features";
import { bad, ok, serverError } from "@/lib/server/http";
import { hasAnyLLM } from "@/lib/server/llm";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!hasAnyLLM()) return bad("AI не настроен (нет ключа)", 503);
    const body = (await req.json()) as { topicId?: string };
    if (!body.topicId) return bad("Не выбрана тема");

    const children = await db.topic.findMany({ where: { parentId: body.topicId }, select: { id: true } });
    const topicIds = [body.topicId, ...children.map((c) => c.id)];
    const topic = await db.topic.findUnique({ where: { id: body.topicId } });
    const all = await db.knowledge.findMany({ where: { topicId: { in: topicIds } }, take: 30 });
    if (!all.length) return ok({ questions: [], message: "В этой теме нет знаний." });

    const contexts: AskContext[] = all.map((k) => ({
      id: k.id,
      title: k.title,
      content: [k.content, jsonArray(k.keyPoints).join("; ")].filter(Boolean).join(" — "),
      source: null,
    }));
    const questions = await generateQuiz(topic?.name ?? "тема", contexts);
    return ok({ questions });
  } catch (e) {
    return serverError(e);
  }
}
