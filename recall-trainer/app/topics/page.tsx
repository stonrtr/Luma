import { TopicsBrowser } from "@/components/TopicsBrowser";
import { db } from "@/lib/db";
import { jsonArray } from "@/lib/db-mappers";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const [topics, knowledge] = await Promise.all([
    db.topic.findMany({
      include: { _count: { select: { knowledge: true } } },
      orderBy: { name: "asc" },
    }),
    db.knowledge.findMany({
      select: { id: true, title: true, topicId: true, keyPoints: true, importance: true, lastReviewedAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Темы</h1>
        <p className="page-sub">Тема → Подтема → Знания. Освежайте и проверяйте себя.</p>
      </div>
      <TopicsBrowser
        topics={topics.map((t) => ({ id: t.id, name: t.name, parentId: t.parentId, count: t._count.knowledge }))}
        knowledge={knowledge.map((k) => ({
          id: k.id,
          title: k.title,
          topicId: k.topicId,
          keyPoints: jsonArray(k.keyPoints),
          importance: k.importance,
          lastReviewedAt: k.lastReviewedAt ? k.lastReviewedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
