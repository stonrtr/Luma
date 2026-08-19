import { db } from "@/lib/db";
import { jsonArray } from "@/lib/db-mappers";
import { embed } from "@/lib/server/embed";
import { ok, serverError } from "@/lib/server/http";
import { knowledgeEmbedText, resolveTopicPath } from "@/lib/server/topics";

export const maxDuration = 60;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (typeof body.title === "string") data.title = body.title.trim();
    if (typeof body.content === "string") data.content = body.content.trim();
    if (typeof body.personalComment === "string") data.personalComment = body.personalComment.trim();
    if (typeof body.importance === "number") data.importance = body.importance;
    if (typeof body.favorite === "boolean") data.favorite = body.favorite;
    if (Array.isArray(body.keyPoints)) data.keyPoints = JSON.stringify(body.keyPoints.map(String));
    if (Array.isArray(body.tags)) data.tags = JSON.stringify(body.tags.map(String));
    if (body.topicId === null || typeof body.topicId === "string") data.topicId = body.topicId;
    else if (typeof body.topicPath === "string") data.topicId = await resolveTopicPath(body.topicPath);

    // Пересчитываем эмбеддинг, если менялся смысловой контент.
    const contentChanged =
      "title" in data || "content" in data || "keyPoints" in data || "tags" in data;
    if (contentChanged) {
      const current = await db.knowledge.findUnique({ where: { id } });
      if (current) {
        const emb = await embed(
          knowledgeEmbedText({
            title: (data.title as string) ?? current.title,
            content: (data.content as string) ?? current.content,
            keyPoints: jsonArray((data.keyPoints as string) ?? current.keyPoints),
            tags: jsonArray((data.tags as string) ?? current.tags),
          })
        );
        if (emb) data.embedding = JSON.stringify(emb);
      }
    }

    const k = await db.knowledge.update({ where: { id }, data });
    return ok({ id: k.id });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.knowledge.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
