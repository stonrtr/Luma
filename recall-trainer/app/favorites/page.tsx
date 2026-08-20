import { KnowledgeList } from "@/components/KnowledgeList";
import { db } from "@/lib/db";
import { mapKnowledge } from "@/lib/db-mappers";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const [items, topics] = await Promise.all([
    db.knowledge.findMany({
      where: { favorite: true },
      include: { topic: { include: { parent: true } }, source: true, card: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.topic.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Избранное</h1>
        <p className="page-sub">Знания, отмеченные звёздочкой</p>
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">⭐</div>
          Пока нет избранного. Отмечайте важные знания звёздочкой.
        </div>
      ) : (
        <KnowledgeList items={items.map(mapKnowledge)} topics={topics.map((t) => ({ id: t.id, name: t.name }))} />
      )}
    </div>
  );
}
