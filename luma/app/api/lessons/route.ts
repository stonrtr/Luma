import { db } from "@/lib/db";
import { toLesson } from "@/lib/serialize";
import { badRequest, json, readJson, str } from "@/lib/server/http";

/* eslint-disable @typescript-eslint/no-explicit-any */

function lastReviewedOf(phrases: any[]): number {
  let t = 0;
  for (const p of phrases) if (p.lastReviewedAt) t = Math.max(t, new Date(p.lastReviewedAt).getTime());
  return t;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const archived = url.searchParams.get("archived") === "true";
  const sort = url.searchParams.get("sort") || "recent";

  const rows = await db.lesson.findMany({
    where: { archived },
    include: {
      topic: { select: { name: true } },
      phrases: {
        select: { progress: true, known: true, dueAt: true, translationStatus: true, lastReviewedAt: true },
      },
    },
  });

  const lessons = rows.map((r) => ({ lesson: toLesson(r), lastReviewed: lastReviewedOf(r.phrases) }));

  lessons.sort((a, b) => {
    const A = a.lesson;
    const B = b.lesson;
    switch (sort) {
      case "attention":
        return B.stats.due - A.stats.due || A.stats.progress - B.stats.progress;
      case "worst":
        return A.stats.progress - B.stats.progress;
      case "stale":
        return a.lastReviewed - b.lastReviewed;
      case "new":
        return new Date(B.createdAt).getTime() - new Date(A.createdAt).getTime();
      case "title":
        return A.title.localeCompare(B.title, "ru");
      case "count":
        return B.stats.total - A.stats.total;
      case "recent":
      default: {
        const ao = A.lastOpenedAt ? new Date(A.lastOpenedAt).getTime() : 0;
        const bo = B.lastOpenedAt ? new Date(B.lastOpenedAt).getTime() : 0;
        return bo - ao || new Date(B.createdAt).getTime() - new Date(A.createdAt).getTime();
      }
    }
  });

  return json(lessons.map((l) => l.lesson));
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const title = str(body.title, 160).trim();
  if (!title) return badRequest("Название урока обязательно");

  let topicId: string | null = null;
  const newTopicName = str(body.newTopicName, 120).trim();
  if (newTopicName) {
    const count = await db.topic.count();
    const topic = await db.topic.create({ data: { name: newTopicName, position: count } });
    topicId = topic.id;
  } else if (body.topicId && typeof body.topicId === "string") {
    topicId = body.topicId; // "Без темы" → null (client sends empty)
  }

  const lesson = await db.lesson.create({
    data: { title, topicId },
    include: { topic: { select: { name: true } }, phrases: true },
  });
  return json(toLesson(lesson), { status: 201 });
}
