import { db } from "@/lib/db";
import { cosine, embed, parseEmbedding } from "@/lib/server/embed";
import { ok, serverError } from "@/lib/server/http";
import { knowledgeEmbedText } from "@/lib/server/topics";

export const maxDuration = 60;

// §36: перед сохранением ищем похожие знания.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { title?: string; content?: string; excludeId?: string };
    const vec = await embed(knowledgeEmbedText({ title: body.title ?? "", content: body.content ?? "" }));
    if (!vec) return ok({ candidates: [] });

    const all = await db.knowledge.findMany({
      where: body.excludeId ? { id: { not: body.excludeId } } : undefined,
      select: { id: true, title: true, embedding: true },
    });
    const candidates = all
      .map((k) => {
        const v = parseEmbedding(k.embedding);
        return { id: k.id, title: k.title, similarity: v ? cosine(vec, v) : 0 };
      })
      .filter((c) => c.similarity >= 0.82)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
    return ok({ candidates });
  } catch (e) {
    return serverError(e);
  }
}
