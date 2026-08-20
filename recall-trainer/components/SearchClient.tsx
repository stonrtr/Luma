"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { SearchHit } from "@/lib/types";
import { Spinner, toast } from "./ui";

export function SearchClient() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("auto");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const r = await api.search(q.trim(), mode);
      setHits(r.hits);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="mental availability · или обычным языком: как бренд вспоминают перед покупкой?"
          autoFocus
        />
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? <Spinner /> : "🔍"} Найти
        </button>
      </div>
      <div className="row wrap" style={{ gap: 6, marginBottom: 20 }}>
        {[
          ["auto", "Умный (смысл + слова)"],
          ["semantic", "По смыслу"],
          ["keyword", "По словам"],
        ].map(([m, l]) => (
          <button key={m} className={`chip ${mode === m ? "chip-accent" : ""}`} onClick={() => setMode(m)} style={{ cursor: "pointer" }}>
            {l}
          </button>
        ))}
      </div>

      {hits === null ? (
        <div className="empty">
          <div className="empty-emoji">🔍</div>
          Ищите по всей базе — по названию, тексту или просто по смыслу.
        </div>
      ) : hits.length === 0 ? (
        <div className="empty">Ничего не найдено. Попробуйте другой запрос.</div>
      ) : (
        <div className="stack">
          {hits.map((h) => (
            <Link key={h.id} href={`/knowledge/${h.id}`} className="card pad" style={{ display: "block" }}>
              <div className="row spread">
                <strong>{h.title}</strong>
                <span className={`chip ${h.kind === "semantic" ? "chip-accent" : ""}`}>
                  {h.kind === "semantic" ? "по смыслу" : "совпадение"}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 13.5, margin: "6px 0 0" }}>{h.snippet}</p>
              <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                {h.topicPath && <span className="chip">{h.topicPath}</span>}
                {h.sourceTitle && <span className="faint" style={{ fontSize: 12 }}>{h.sourceTitle}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
