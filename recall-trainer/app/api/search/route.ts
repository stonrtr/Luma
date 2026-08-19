import { db } from "@/lib/db";
import { jsonArray, topicPath } from "@/lib/db-mappers";
import { cosine, embed, parseEmbedding } from "@/lib/server/embed";
import { bad, ok, serverError } from "@/lib/server/http";
import type { SearchHit } from "@/lib/types";

export const maxDuration = 60;

function snippet(content: string, query: string): string {
  const c = content.replace(/\s+/g, " ").trim();
  const i = c.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return c.slice(0, 160);
  const start = Math.max(0, i - 40);
  return (start > 0 ? "…" : "") + c.slice(start, start + 160);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { query?: string; mode?: string };
    const query = (body.query ?? "").trim();
    if (!query) return bad("Пустой запрос");
    const mode = body.mode ?? "auto";

    const all = await db.knowledge.findMany({
      include: { topic: { include: { parent: true } }, source: true },
      orderBy: { updatedAt: "desc" },
    });

    const q = query.toLowerCase();
    const keywordScore = (title: string, content: string, tags: string[]) => {
      let s = 0;
      if (title.toLowerCase().includes(q)) s += 3;
      if (content.toLowerCase().includes(q)) s += 1;
      if (tags.some((t) => t.toLowerCase().includes(q))) s += 2;
      return s;
    };

    // Семантика — только если запрос удалось векторизовать.
    const queryVec = mode === "keyword" ? null : await embed(query);

    const hits: SearchHit[] = [];
    for (const k of all) {
      const tags = jsonArray(k.tags);
      const kw = keywordScore(k.title, k.content, tags);
      let sem = 0;
      if (queryVec) {
        const v = parseEmbedding(k.embedding);
        if (v) sem = cosine(queryVec, v);
      }
      // Итоговый скор: семантика (0..1) весит сильнее, ключевые слова добавляют буст.
      const score = sem + kw * 0.15;
      const relevant = kw > 0 || sem >= 0.6;
      if (!relevant) continue;
      hits.push({
        id: k.id,
        title: k.title,
        snippet: snippet(k.content, query),
        topicPath: topicPath(k.topic),
        sourceTitle: k.source?.title ?? null,
        score,
        kind: sem >= 0.6 && kw === 0 ? "semantic" : "keyword",
      });
    }

    hits.sort((a, b) => b.score - a.score);
    return ok({ hits: hits.slice(0, 30) });
  } catch (e) {
    return serverError(e);
  }
}
