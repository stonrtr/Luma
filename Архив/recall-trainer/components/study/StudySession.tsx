"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "@/lib/api";
import { Spinner, EmptyState, formatInterval, useToast } from "../ui";
import type { StudyScope } from "../app-context";
import type { Knowledge, Rating } from "@/lib/types";

export function StudySession({ scope, onClose }: { scope: StudyScope; onClose: () => void }) {
  const toast = useToast();
  const [cards, setCards] = useState<Knowledge[] | null>(scope.cards ?? null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scope.cards) return;
    A.study(scope.scope, scope.collectionId)
      .then((r) => setCards(r.cards))
      .catch(() => setCards([]));
  }, [scope]);

  const current = cards?.[index] ?? null;

  const reveal = useCallback(() => {
    setRevealed(true);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        const { intervalDays } = await A.review(current.id, rating, usedHint);
        setReviewedCount((c) => c + 1);
        toast(`Следующее повторение ${formatInterval(intervalDays)}`, rating === "again" ? "info" : "success");
        setRevealed(false);
        setUsedHint(false);
        setHintShown(false);
        setIndex((i) => i + 1);
      } catch (e) {
        toast((e as Error).message, "error");
      } finally {
        setBusy(false);
      }
    },
    [current, busy, usedHint, toast]
  );

  // Keyboard shortcuts: Space/Enter reveal; 1/2/3 rate; Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (!current) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      } else if (revealed) {
        if (e.key === "1") rate("again");
        else if (e.key === "2") rate("hard");
        else if (e.key === "3") rate("easy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, reveal, rate, onClose]);

  const total = cards?.length ?? 0;
  const done = cards !== null && index >= total;

  return (
    <div className="overlay" style={{ alignItems: "stretch", padding: 0, background: "var(--background)" }}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100dvh" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)", flex: "none" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Закрыть">✕</button>
          <div style={{ flex: 1 }}>
            <div className="progress"><span style={{ width: `${total ? (Math.min(index, total) / total) * 100 : 0}%` }} /></div>
          </div>
          <div className="muted" style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", flex: "none" }}>
            {Math.min(index + (done ? 0 : 1), total)} / {total}
          </div>
        </div>

        {/* Body */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div className="container" style={{ maxWidth: 640 }}>
            {cards === null ? (
              <div style={{ display: "grid", placeItems: "center", padding: 80 }}><Spinner size={28} /></div>
            ) : total === 0 ? (
              <div style={{ paddingTop: 40 }}>
                <EmptyState icon="✅" title="Нет тем для повторения" hint="Очередь пуста." action={<button className="btn btn-primary" onClick={onClose}>Готово</button>} />
              </div>
            ) : done ? (
              <div style={{ paddingTop: 40 }}>
                <EmptyState
                  icon="🎉"
                  title="Повторение завершено"
                  hint={`Вы повторили ${reviewedCount} ${plural(reviewedCount, "тему", "темы", "тем")}. Так знания не забываются.`}
                  action={<button className="btn btn-primary" onClick={onClose}>Готово</button>}
                />
              </div>
            ) : current ? (
              <>
                {current.collectionName && (
                  <div style={{ textAlign: "center", marginBottom: 10 }}>
                    <span className="pill pill-muted">{current.collectionName}</span>
                  </div>
                )}
                <div className="card" style={{ padding: 24, marginBottom: 16 }}>
                  <div className="label" style={{ textAlign: "center" }}>Вопрос</div>
                  <p style={{ fontSize: 21, fontWeight: 700, textAlign: "center", margin: "8px 0 0", lineHeight: 1.4 }}>
                    {current.question}
                  </p>
                  <p className="muted" style={{ textAlign: "center", fontSize: 13, marginTop: 14, marginBottom: 0 }}>
                    {current.title}
                  </p>
                </div>

                {/* Hint: key points, before full reveal */}
                {!revealed && current.keyPoints.length > 0 && (
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    {hintShown ? (
                      <div className="card" style={{ padding: 16, textAlign: "left" }}>
                        <div className="label">Подсказка — что нужно вспомнить</div>
                        <ul style={{ margin: "4px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
                          {current.keyPoints.map((p, i) => (<li key={i}>{p}</li>))}
                        </ul>
                      </div>
                    ) : (
                      <button className="btn-hint btn" onClick={() => { setHintShown(true); setUsedHint(true); }}>
                        💡 Подсказка
                      </button>
                    )}
                  </div>
                )}

                {/* Reveal / answer */}
                {revealed ? (
                  <div className="card" style={{ padding: 20 }}>
                    <div className="label">Конспект</div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, fontSize: 16, marginTop: 4 }}>
                      {current.sourceText}
                    </div>
                    {current.keyPoints.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div className="label">Ключевые пункты</div>
                        <ul style={{ margin: "4px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
                          {current.keyPoints.map((p, i) => (<li key={i}>{p}</li>))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {/* Footer actions */}
        {current && !done && (
          <div style={{ flex: "none", borderTop: "1px solid var(--border)", padding: "12px 16px", background: "var(--surface)" }}>
            <div className="container" style={{ maxWidth: 640 }}>
              {!revealed ? (
                <button className="btn btn-primary" style={{ width: "100%", minHeight: 52, fontSize: 17 }} onClick={reveal}>
                  Показать конспект
                </button>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <button className="btn" style={{ minHeight: 52, borderColor: "color-mix(in srgb, var(--danger) 40%, var(--border))", color: "var(--danger)" }} onClick={() => rate("again")} disabled={busy}>
                    Не вспомнил
                  </button>
                  <button className="btn" style={{ minHeight: 52 }} onClick={() => rate("hard")} disabled={busy}>
                    С трудом
                  </button>
                  <button className="btn btn-primary" style={{ minHeight: 52 }} onClick={() => rate("easy")} disabled={busy}>
                    Легко
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
