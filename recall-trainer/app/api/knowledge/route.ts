import { db } from "@/lib/db";
import { embed } from "@/lib/server/embed";
import { bad, ok, serverError } from "@/lib/server/http";
import { knowledgeEmbedText, resolveTopicPath } from "@/lib/server/topics";

export const maxDuration = 60;

// Ручное добавление знания (§3.1, §15).
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title?: string;
      content?: string;
      keyPoints?: string[];
      topicId?: string | null;
      topicPath?: string;
      tags?: string[];
      personalComment?: string;
      importance?: number;
    };
    const title = (body.title ?? "").trim();
    const content = (body.content ?? "").trim();
    if (!title && !content) return bad("Нужны название или текст");

    const topicId = body.topicId ?? (await resolveTopicPath(body.topicPath));
    const keyPoints = Array.isArray(body.keyPoints) ? body.keyPoints.map(String) : [];
    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
    const emb = await embed(knowledgeEmbedText({ title, content, keyPoints, tags }));

    const k = await db.knowledge.create({
      data: {
        title: title || content.slice(0, 60),
        content,
        keyPoints: JSON.stringify(keyPoints),
        tags: JSON.stringify(tags),
        topicId,
        personalComment: (body.personalComment ?? "").trim(),
        importance: body.importance ?? 2,
        embedding: emb ? JSON.stringify(emb) : null,
      },
    });

    const day = new Date().toISOString().slice(0, 10);
    await db.dailyActivity.upsert({
      where: { day },
      create: { day, created: 1 },
      update: { created: { increment: 1 } },
    });

    return ok({ id: k.id });
  } catch (e) {
    return serverError(e);
  }
}
