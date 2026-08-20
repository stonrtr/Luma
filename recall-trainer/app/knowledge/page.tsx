import { KnowledgeList } from "@/components/KnowledgeList";
import { db } from "@/lib/db";
import { mapKnowledge } from "@/lib/db-mappers";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const [items, topics] = await Promise.all([
    db.knowledge.findMany({
      include: { topic: { include: { parent: true } }, source: true, card: true },
      orderBy: { createdAt: "desc" },
    }),
    db.topic.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Мои знания</h1>
        <p className="page-sub">Отобранная вами база — используется в поиске, вопросах и повторении</p>
      </div>
      <KnowledgeList
        items={items.map(mapKnowledge)}
        topics={topics.map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  );
}
