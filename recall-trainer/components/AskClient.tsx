"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Spinner, toast } from "./ui";

export function AskClient() {
  const [q, setQ] = useState("");
  const [external, setExternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [contexts, setContexts] = useState<{ id: string; title: string; source: string | null }[]>([]);

  async function ask() {
    if (!q.trim()) return;
    setBusy(true);
    setAnswer(null);
    try {
      const r = await api.ask(q.trim(), external);
      setAnswer(r.answer);
      setContexts(r.contexts);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card pad" style={{ marginBottom: 18 }}>
        <textarea
          className="textarea"
          rows={2}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
          }}
          placeholder="Что я знаю про Customer Retention?"
          autoFocus
        />
        <div className="row spread wrap" style={{ marginTop: 12 }}>
          <label className="row" style={{ gap: 8, cursor: "pointer", fontSize: 13.5 }}>
            <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} />
            {external ? "Мои знания + дополнение AI" : "Только мои знания"}
          </label>
          <button className="btn btn-primary" onClick={ask} disabled={busy || !q.trim()}>
            {busy ? <Spinner /> : "✨"} Спросить
          </button>
        </div>
      </div>

      {busy && (
        <div className="row" style={{ color: "var(--text-soft)" }}>
          <Spinner /> Ищу в вашей базе и формирую ответ…
        </div>
      )}

      {answer && (
        <div className="card pad">
          <div className="row spread" style={{ marginBottom: 10 }}>
            <strong>Ответ</strong>
            <span className={`chip ${external ? "chip-amber" : "chip-green"}`}>
              {external ? "с дополнением AI" : "только моя база"}
            </span>
          </div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{answer}</div>
          {contexts.length > 0 && (
            <>
              <div className="divider" />
              <p className="faint" style={{ fontSize: 12, margin: "0 0 8px" }}>Источники ответа:</p>
              <div className="stack" style={{ gap: 6 }}>
                {contexts.map((c, i) => (
                  <Link key={c.id} href={`/knowledge/${c.id}`} className="row" style={{ gap: 8, fontSize: 13.5 }}>
                    <span className="chip chip-accent">{i + 1}</span>
                    <span>{c.title}</span>
                    {c.source && <span className="faint">· {c.source}</span>}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
