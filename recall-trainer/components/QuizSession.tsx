"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Modal, Spinner, toast } from "./ui";

type Q = { id: string | null; question: string };
type Result = { verdict: string; feedback: string } | null;

const VERDICT: Record<string, { label: string; chip: string }> = {
  correct: { label: "Верно", chip: "chip-green" },
  partial: { label: "Частично", chip: "chip-amber" },
  missed: { label: "Не вспомнил", chip: "chip-red" },
};

// «Проверь меня» (§29): AI задаёт вопросы по сохранённой базе темы.
export function QuizSession({ topicId, topicName, onClose }: { topicId: string; topicName: string; onClose: () => void }) {
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.quiz(topicId);
        if (!r.questions.length) setErr(r.message || "Нет знаний для проверки.");
        else setQuestions(r.questions);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [topicId]);

  async function submit() {
    if (!questions || !answer.trim()) return;
    setBusy(true);
    try {
      const q = questions[idx];
      const r = await api.gradeQuiz({ question: q.question, knowledgeId: q.id, answer: answer.trim() });
      setResult(r);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setResult(null);
    setAnswer("");
    setIdx((i) => i + 1);
  }

  const q = questions?.[idx];
  const done = questions && idx >= questions.length;

  return (
    <Modal onClose={onClose} width={600}>
      <div className="row spread">
        <h2 className="modal-title">Проверь меня · {topicName}</h2>
        {questions && <span className="chip">{Math.min(idx + 1, questions.length)}/{questions.length}</span>}
      </div>

      {err && <div className="empty">{err}</div>}
      {!questions && !err && (
        <div className="row" style={{ padding: 24 }}>
          <Spinner /> AI составляет вопросы…
        </div>
      )}

      {q && !done && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 17, fontWeight: 600 }}>{q.question}</p>
          <textarea
            className="textarea"
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Ответьте своими словами…"
            disabled={!!result}
            autoFocus
          />
          {result && (
            <div className="card pad" style={{ marginTop: 12, background: "var(--bg-sunken)" }}>
              <span className={`chip ${VERDICT[result.verdict]?.chip ?? ""}`}>
                {VERDICT[result.verdict]?.label ?? result.verdict}
              </span>
              <p style={{ margin: "8px 0 0" }}>{result.feedback}</p>
              {q.id && (
                <Link href={`/knowledge/${q.id}`} className="btn btn-sm" style={{ marginTop: 10 }}>
                  Открыть знание →
                </Link>
              )}
            </div>
          )}
          <div className="row spread" style={{ marginTop: 14 }}>
            <span />
            {result ? (
              <button className="btn btn-primary" onClick={next}>
                {idx + 1 < (questions?.length ?? 0) ? "Следующий вопрос" : "Завершить"}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={submit} disabled={busy || !answer.trim()}>
                {busy ? <Spinner /> : null} Проверить
              </button>
            )}
          </div>
        </div>
      )}

      {done && (
        <div className="empty">
          <div className="empty-emoji">🎉</div>
          Проверка завершена!
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={onClose}>Готово</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
