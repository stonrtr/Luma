import { notFound } from "next/navigation";
import { KnowledgeDetail } from "@/components/KnowledgeDetail";
import { db } from "@/lib/db";
import { mapKnowledge } from "@/lib/db-mappers";
import { cosine, parseEmbedding } from "@/lib/server/embed";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await db.knowledge.findUnique({
    where: { id },
    include: {
      topic: { include: { parent: true } },
      source: true,
      card: true,
      linksFrom: { include: { to: { select: { id: true, title: true } } } },
    },
  });
  if (!k) notFound();

  // Похожие знания для предложения связей (§37).
  const linkedIds = new Set(k.linksFrom.map((l) => l.toId));
  linkedIds.add(k.id);
  const vec = parseEmbedding(k.embedding);
  let suggestions: { id: string; title: string; similarity: number }[] = [];
  if (vec) {
    const others = await db.knowledge.findMany({
      where: { id: { notIn: [...linkedIds] } },
      select: { id: true, title: true, embedding: true },
    });
    suggestions = others
      .map((o) => {
        const v = parseEmbedding(o.embedding);
        return { id: o.id, title: o.title, similarity: v ? cosine(vec, v) : 0 };
      })
      .filter((s) => s.similarity >= 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);
  }

  return (
    <KnowledgeDetail
      knowledge={mapKnowledge(k)}
      suggestions={suggestions}
      card={k.card ? { question: k.card.question, answer: k.card.answer } : null}
    />
  );
}
