"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { relTime } from "@/lib/format";
import type { KnowledgeDTO } from "@/lib/types";

export function KnowledgeList({
  items,
  topics,
}: {
  items: KnowledgeDTO[];
  topics: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const [fav, setFav] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((k) => {
      if (fav && !k.favorite) return false;
      if (topic && k.topicId !== topic) return false;
      if (!query) return true;
      return (
        k.title.toLowerCase().includes(query) ||
        k.content.toLowerCase().includes(query) ||
        k.tags.some((t) => t.toLowerCase().includes(query))
      );
    });
  }, [items, q, topic, fav]);

  return (
    <div>
      <div className="row wrap" style={{ marginBottom: 18, gap: 10 }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Фильтр по названию, тексту, тегам…"
        />
        <select className="select" style={{ width: "auto" }} value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Все темы</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button className={`btn ${fav ? "btn-primary" : ""}`} onClick={() => setFav((v) => !v)}>
          ⭐ Избранное
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">📚</div>
          {items.length === 0 ? "Знаний пока нет — добавьте первое." : "Ничего не найдено."}
        </div>
      ) : (
        <div className="grid grid-2">
          {filtered.map((k) => (
            <Link key={k.id} href={`/knowledge/${k.id}`} className="card pad" style={{ display: "block" }}>
              <div className="row spread" style={{ alignItems: "flex-start" }}>
                <strong style={{ fontSize: 15.5 }}>{k.title}</strong>
                {k.favorite && <span>⭐</span>}
              </div>
              {k.content && (
                <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {k.content}
                </p>
              )}
              <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                {k.topicPath && <span className="chip">{k.topicPath}</span>}
                {k.importance >= 3 && <span className="chip chip-red">важное</span>}
                {k.hasCard && <span className="chip chip-green">🔁 в повторении</span>}
                <span className="faint" style={{ fontSize: 12, marginLeft: "auto" }}>{relTime(k.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="faint" style={{ marginTop: 16, fontSize: 13 }}>
        {filtered.length} из {items.length}
      </p>
    </div>
  );
}
