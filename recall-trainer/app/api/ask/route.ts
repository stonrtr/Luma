import { db } from "@/lib/db";
import { jsonArray } from "@/lib/db-mappers";
import { askMyBase, type AskContext } from "@/lib/server/ai-features";
import { cosine, embed, parseEmbedding } from "@/lib/server/embed";
import { bad, ok, serverError } from "@/lib/server/http";
import { hasAnyLLM } from "@/lib/server/llm";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!hasAnyLLM()) return bad("AI не настроен (нет ключа)", 503);
    const body = (await req.json()) as {
      question?: string;
      allowExternal?: boolean;
      topicId?: string;
    };
    const question = (body.question ?? "").trim();
    if (!question) return bad("Пустой вопрос");

    const all = await db.knowledge.findMany({
      where: body.topicId ? { topicId: body.topicId } : undefined,
      include: { source: true },
    });
    if (!all.length) return ok({ answer: "В базе пока нет знаний.", contexts: [] });

    const qVec = await embed(question);
    const q = question.toLowerCase();
    const ranked = all
      .map((k) => {
        const v = parseEmbedding(k.embedding);
        const sem = qVec && v ? cosine(qVec, v) : 0;
        const kw = k.title.toLowerCase().includes(q) || k.content.toLowerCase().includes(q) ? 0.3 : 0;
        return { k, score: sem + kw };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .filter((r) => r.score > 0.1 || !qVec);

    const contexts: AskContext[] = ranked.map(({ k }) => ({
      id: k.id,
      title: k.title,
      content: [k.content, jsonArray(k.keyPoints).join("; ")].filter(Boolean).join(" — "),
      source: k.source?.title ?? null,
    }));

    const answer = await askMyBase(question, contexts, !!body.allowExternal);
    return ok({
      answer,
      contexts: contexts.map((c) => ({ id: c.id, title: c.title, source: c.source })),
    });
  } catch (e) {
    return serverError(e);
  }
}
