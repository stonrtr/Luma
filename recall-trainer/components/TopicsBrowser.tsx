"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { QuizSession } from "./QuizSession";
import { relTime } from "@/lib/format";
import { toast } from "./ui";

type Topic = { id: string; name: string; parentId: string | null; count: number };
type K = {
  id: string;
  title: string;
  topicId: string | null;
  keyPoints: string[];
  importance: number;
  lastReviewedAt: string | null;
};

export function TopicsBrowser({ topics, knowledge }: { topics: Topic[]; knowledge: K[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(topics[0]?.id ?? null);
  const [quiz, setQuiz] = useState<{ id: string; name: string } | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [refresh, setRefresh] = useState(false);

  const roots = topics.filter((t) => !t.parentId);
  const childrenOf = (id: string) => topics.filter((t) => t.parentId === id);
  const current = topics.find((t) => t.id === selected);

  // Знания темы + её подтем.
  const subtopicIds = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set([selected, ...childrenOf(selected).map((c) => c.id)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, topics]);

  const items = knowledge.filter((k) => k.topicId && subtopicIds.has(k.topicId));
  const stale = [...items].sort(
    (a, b) => (a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0) - (b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0)
  );

  async function createTopic() {
    if (!newTopic.trim()) return;
    try {
      await api.createTopic({ name: newTopic.trim() });
      setNewTopic("");
      toast("Тема создана");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function rename(id: string, oldName: string) {
    const name = prompt("Новое название темы:", oldName);
    if (!name || name === oldName) return;
    await api.renameTopic(id, name);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Удалить тему? Знания станут «без темы».")) return;
    await api.deleteTopic(id);
    if (selected === id) setSelected(null);
    router.refresh();
  }

  if (topics.length === 0) {
    return (
      <div className="empty">
        <div className="empty-emoji">🗂</div>
        Темы появятся, когда вы сохраните знания. Можно создать вручную:
        <div className="row" style={{ maxWidth: 320, margin: "16px auto 0" }}>
          <input className="input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="Название темы" />
          <button className="btn btn-primary" onClick={createTopic}>Создать</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "280px 1fr", alignItems: "start" }}>
      <div className="card pad">
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="Новая тема" onKeyDown={(e) => e.key === "Enter" && createTopic()} />
          <button className="btn btn-primary btn-sm" onClick={createTopic}>＋</button>
        </div>
        <div className="stack" style={{ gap: 2 }}>
          {roots.map((t) => (
            <div key={t.id}>
              <button className={`nav-link ${selected === t.id ? "active" : ""}`} style={{ width: "100%" }} onClick={() => setSelected(t.id)}>
                🗂 {t.name}
                <span className="nav-badge" style={{ background: "var(--border-strong)", color: "var(--text-soft)" }}>{t.count}</span>
              </button>
              {childrenOf(t.id).map((c) => (
                <button key={c.id} className={`nav-link ${selected === c.id ? "active" : ""}`} style={{ width: "100%", paddingLeft: 30, fontSize: 13.5 }} onClick={() => setSelected(c.id)}>
                  {c.name}
                  <span className="nav-badge" style={{ background: "var(--border-strong)", color: "var(--text-soft)" }}>{c.count}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        {current ? (
          <>
            <div className="row spread wrap" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>{current.name}</h2>
              <div className="row">
                <button className={`btn btn-sm ${refresh ? "btn-primary" : ""}`} onClick={() => setRefresh((v) => !v)}>
                  🔆 Освежить знания
                </button>
                <button className="btn btn-sm btn-primary" onClick={() => setQuiz({ id: current.id, name: current.name })}>
                  🧠 Проверь меня
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => rename(current.id, current.name)}>✏️</button>
                <button className="btn btn-sm btn-danger" onClick={() => del(current.id)}>🗑</button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="empty">В этой теме пока нет знаний.</div>
            ) : refresh ? (
              // Освежить знания (§28): суть + тезисы + давно не смотренные
              <div className="stack">
                <p className="muted" style={{ fontSize: 13.5 }}>Быстрое повторение: ключевые тезисы по теме.</p>
                {stale.map((k) => (
                  <div key={k.id} className="card pad">
                    <div className="row spread">
                      <Link href={`/knowledge/${k.id}`}><strong>{k.title}</strong></Link>
                      <span className="faint" style={{ fontSize: 12 }}>
                        {k.lastReviewedAt ? `повторено ${relTime(k.lastReviewedAt)}` : "не повторялось"}
                      </span>
                    </div>
                    {k.keyPoints.length > 0 && (
                      <ul className="kp-list" style={{ marginTop: 8 }}>
                        {k.keyPoints.slice(0, 4).map((kp, i) => (
                          <li key={i} className="kp-item">{kp}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-2">
                {items.map((k) => (
                  <Link key={k.id} href={`/knowledge/${k.id}`} className="card pad" style={{ display: "block" }}>
                    <strong>{k.title}</strong>
                    {k.keyPoints[0] && <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>{k.keyPoints[0]}</p>}
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty">Выберите тему слева.</div>
        )}
      </div>

      {quiz && <QuizSession topicId={quiz.id} topicName={quiz.name} onClose={() => setQuiz(null)} />}
    </div>
  );
}
