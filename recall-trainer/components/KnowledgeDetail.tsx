"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { KnowledgeDTO } from "@/lib/types";
import { KnowledgeEditor } from "./KnowledgeEditor";
import { fmtTimecode, relTime } from "@/lib/format";
import { Spinner, toast } from "./ui";

const SOURCE_TYPE_LABEL: Record<string, string> = {
  YOUTUBE: "YouTube",
  TEXT: "Текст",
  ARTICLE: "Статья",
  PDF: "PDF",
  THOUGHT: "Своя мысль",
};

type Card = { question: string; answer: string } | null;

export function KnowledgeDetail({
  knowledge,
  suggestions,
  card: initialCard,
}: {
  knowledge: KnowledgeDTO;
  suggestions: { id: string; title: string; similarity: number }[];
  card: Card;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fav, setFav] = useState(knowledge.favorite);
  const [card, setCard] = useState<Card>(initialCard);
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState(suggestions);

  const k = knowledge;

  async function toggleFav() {
    setFav((v) => !v);
    await api.patchKnowledge(k.id, { favorite: !fav }).catch((e) => toast((e as Error).message));
  }

  async function makeCard() {
    setBusy(true);
    try {
      const r = await api.makeCard(k.id);
      setCard({ question: r.question, answer: r.answer });
      toast("Карточка создана и добавлена в повторение");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeCard() {
    setBusy(true);
    try {
      await api.deleteCard(k.id);
      setCard(null);
      toast("Убрано из повторения");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm("Удалить это знание?")) return;
    await api.deleteKnowledge(k.id);
    toast("Удалено");
    router.push("/knowledge");
    router.refresh();
  }

  async function link(toId: string) {
    try {
      await api.link(k.id, toId);
      setSugg((s) => s.filter((x) => x.id !== toId));
      toast("Связь добавлена");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const ytUrl =
    k.sourceType === "YOUTUBE" && k.sourceUrl && k.sourceStart != null
      ? `${k.sourceUrl}${k.sourceUrl.includes("?") ? "&" : "?"}t=${k.sourceStart}s`
      : k.sourceUrl;

  return (
    <div>
      <Link href="/knowledge" className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
        ← Мои знания
      </Link>

      <div className="row spread wrap" style={{ alignItems: "flex-start", gap: 12 }}>
        <h1 className="page-title" style={{ flex: 1 }}>{k.title}</h1>
        <div className="row">
          <button className="btn btn-sm" onClick={toggleFav}>{fav ? "⭐" : "☆"}</button>
          <button className="btn btn-sm" onClick={() => setEditing(true)}>✏️ Редактировать</button>
          <button className="btn btn-sm btn-danger" onClick={del}>🗑</button>
        </div>
      </div>

      <div className="row wrap" style={{ gap: 8, margin: "10px 0 22px" }}>
        {k.topicPath && <Link href="/topics" className="chip chip-accent">{k.topicPath}</Link>}
        {k.importance >= 3 && <span className="chip chip-red">важное</span>}
        {k.tags.map((t) => (
          <span key={t} className="chip">#{t}</span>
        ))}
        <span className="faint" style={{ fontSize: 12 }}>обновлено {relTime(k.updatedAt)}</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 320px", alignItems: "start" }}>
        <div className="stack">
          <div className="card pad">
            <h3 style={{ margin: "0 0 8px" }}>Суть</h3>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{k.content || <span className="muted">— нет текста —</span>}</p>
          </div>

          {k.keyPoints.length > 0 && (
            <div className="card pad">
              <h3 style={{ margin: "0 0 10px" }}>Ключевые тезисы</h3>
              <ul className="kp-list">
                {k.keyPoints.map((kp, i) => (
                  <li key={i} className="kp-item">{kp}</li>
                ))}
              </ul>
            </div>
          )}

          {k.personalComment && (
            <div className="card pad" style={{ borderLeft: "3px solid var(--accent)" }}>
              <h3 style={{ margin: "0 0 8px" }}>Мой комментарий</h3>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{k.personalComment}</p>
            </div>
          )}

          {/* Повторение (§25, §26) */}
          <div className="card pad">
            <div className="row spread">
              <h3 style={{ margin: 0 }}>Повторение</h3>
              {card ? (
                <button className="btn btn-sm btn-danger" onClick={removeCard} disabled={busy}>
                  Убрать
                </button>
              ) : (
                <button className="btn btn-sm btn-primary" onClick={makeCard} disabled={busy}>
                  {busy ? <Spinner /> : "＋"} Добавить в повторение
                </button>
              )}
            </div>
            {card && (
              <div style={{ marginTop: 10 }}>
                <p className="muted" style={{ fontSize: 13, margin: "0 0 4px" }}>Вопрос</p>
                <p style={{ margin: "0 0 10px", fontWeight: 600 }}>{card.question}</p>
                <p className="muted" style={{ fontSize: 13, margin: "0 0 4px" }}>Ответ</p>
                <p style={{ margin: 0 }}>{card.answer}</p>
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка: источник + связи */}
        <div className="stack">
          {k.sourceId && (
            <div className="card pad">
              <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Источник</h3>
              <strong style={{ fontSize: 14 }}>{k.sourceTitle}</strong>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {SOURCE_TYPE_LABEL[k.sourceType ?? ""] ?? k.sourceType}
              </div>
              {k.sourceStart != null && (
                <div className="tc" style={{ marginTop: 6 }}>
                  ⏱ {fmtTimecode(k.sourceStart)}
                  {k.sourceEnd != null ? `–${fmtTimecode(k.sourceEnd)}` : ""}
                </div>
              )}
              <div className="row" style={{ marginTop: 10, gap: 6 }}>
                <Link href={`/sources/${k.sourceId}`} className="btn btn-sm">Оригинал</Link>
                {ytUrl && (
                  <a href={ytUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
                    ▶️ Открыть
                  </a>
                )}
              </div>
            </div>
          )}

          {(k.related?.length || sugg.length > 0) && (
            <div className="card pad">
              <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Связанные знания</h3>
              {k.related && k.related.length > 0 && (
                <div className="stack" style={{ gap: 6, marginBottom: sugg.length ? 12 : 0 }}>
                  {k.related.map((r) => (
                    <Link key={r.id} href={`/knowledge/${r.id}`} className="chip chip-accent" style={{ width: "fit-content" }}>
                      {r.title}
                    </Link>
                  ))}
                </div>
              )}
              {sugg.length > 0 && (
                <>
                  <p className="faint" style={{ fontSize: 12, margin: "0 0 6px" }}>Возможно связано:</p>
                  <div className="stack" style={{ gap: 6 }}>
                    {sugg.map((s) => (
                      <div key={s.id} className="row spread" style={{ gap: 6 }}>
                        <Link href={`/knowledge/${s.id}`} className="muted" style={{ fontSize: 13.5 }}>
                          {s.title}
                        </Link>
                        <button className="btn btn-sm btn-ghost" onClick={() => link(s.id)} title="Связать">
                          ＋
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <KnowledgeEditor initial={k} onClose={() => setEditing(false)} onSaved={() => router.refresh()} />
      )}
    </div>
  );
}
