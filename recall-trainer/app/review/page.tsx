import Link from "next/link";
import { ReviewSession } from "@/components/ReviewSession";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const now = new Date();
  const due = await db.card.findMany({
    where: { OR: [{ dueAt: { lte: now } }, { dueAt: null }] },
    include: { knowledge: { select: { id: true, title: true } } },
    orderBy: { dueAt: "asc" },
    take: 40,
  });

  const cards = due.map((c) => ({
    id: c.id,
    question: c.question,
    answer: c.answer,
    knowledgeId: c.knowledgeId,
    knowledgeTitle: c.knowledge.title,
  }));

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Повторение</h1>
        <p className="page-sub">
          {cards.length ? `Сегодня — ${cards.length} карточек` : "Интервальное повторение (FSRS)"}
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">✅</div>
          <h2 style={{ margin: "0 0 6px" }}>На сегодня всё повторено</h2>
          <p className="muted">Добавляйте карточки из знаний — они появятся здесь по расписанию.</p>
          <Link href="/knowledge" className="btn btn-primary" style={{ marginTop: 14 }}>
            К знаниям
          </Link>
        </div>
      ) : (
        <ReviewSession cards={cards} />
      )}
    </div>
  );
}
