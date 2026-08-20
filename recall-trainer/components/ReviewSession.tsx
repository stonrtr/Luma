"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "./ui";

type Card = { id: string; question: string; answer: string; knowledgeId: string; knowledgeTitle: string };

export function ReviewSession({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [queue] = useState(cards);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);

  const card = queue[idx];
  const finished = idx >= queue.length;

  const rate = useCallback(
    async (rating: "again" | "hard" | "easy") => {
      if (!card || !shown) return;
      try {
        await api.review(card.id, rating);
      } catch (e) {
        toast((e as Error).message);
      }
      setDone((d) => d + 1);
      setShown(false);
      setIdx((i) => i + 1);
    },
    [card, shown]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.code === "Space" && !shown) {
        e.preventDefault();
        setShown(true);
      } else if (shown) {
        if (e.key === "1") rate("again");
        if (e.key === "2") rate("hard");
        if (e.key === "3") rate("easy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, finished, rate]);

  if (finished) {
    return (
      <div className="empty">
        <div className="empty-emoji">🎉</div>
        <h2 style={{ margin: "0 0 6px" }}>Повторено {done} карточек!</h2>
        <p className="muted">На сегодня всё. Возвращайтесь завтра.</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
          <Link href="/" className="btn">На главную</Link>
          <button className="btn btn-primary" onClick={() => router.refresh()}>Обновить очередь</button>
        </div>
      </div>
    );
  }

  const progress = Math.round((done / queue.length) * 100);

  return (
    <div>
      <div className="progress-bar" style={{ maxWidth: 640, margin: "0 auto 20px" }}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="muted" style={{ textAlign: "center", marginBottom: 16 }}>
        {done} / {queue.length}
      </p>

      <div className="card pad review-card">
        <div className="faint" style={{ fontSize: 12, marginBottom: 8 }}>
          <Link href={`/knowledge/${card.knowledgeId}`}>{card.knowledgeTitle}</Link>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 0" }}>
          <p style={{ fontSize: 20, fontWeight: 600, textAlign: "center", margin: 0 }}>{card.question}</p>
          {shown && (
            <>
              <div className="divider" style={{ margin: "22px 0" }} />
              <p style={{ fontSize: 16, textAlign: "center", margin: 0, whiteSpace: "pre-wrap" }}>{card.answer}</p>
            </>
          )}
        </div>

        {!shown ? (
          <button className="btn btn-primary btn-block" onClick={() => setShown(true)}>
            Показать ответ <span className="faint" style={{ marginLeft: 6 }}>(Space)</span>
          </button>
        ) : (
          <div className="rate-grid">
            <button className="rate-btn rate-again" onClick={() => rate("again")}>
              Не помню<small>1</small>
            </button>
            <button className="rate-btn rate-hard" onClick={() => rate("hard")}>
              Тяжело<small>2</small>
            </button>
            <button className="rate-btn rate-easy" onClick={() => rate("easy")}>
              Помню<small>3</small>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
