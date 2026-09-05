"use client";
import { useCallback, useEffect, useState } from "react";
import { A } from "@/lib/api";
import type { PhraseCard } from "@/lib/types";
import { difficultyBand } from "@/lib/difficulty";
import { useApp } from "../app-context";
import { Confirm, EditIcon, EmptyState, Spinner, Star, TrashIcon, useToast } from "../ui";
import { AddPhraseDialog } from "../dialogs/AddPhraseDialog";
import { EditPhraseDialog } from "../dialogs/EditPhraseDialog";

const SORTS: [string, string][] = [
  ["worst", "Хуже всего изучены"],
  ["added", "Недавно добавленные"],
  ["opened", "Недавно открытые"],
  ["stale", "Давно не повторялись"],
  ["hard", "Высокая сложность"],
  ["easy", "Низкая сложность"],
  ["lesson", "По уроку"],
  ["alpha", "По алфавиту"],
];

export function PhrasesSection() {
  const { refreshKey, refresh, startStudy } = useApp();
  const [sort, setSort] = useState("worst");
  const [favOnly, setFavOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [phrases, setPhrases] = useState<PhraseCard[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PhraseCard | null>(null);
  const [deleting, setDeleting] = useState<PhraseCard | null>(null);
  const [local, setLocal] = useState(0);
  const toast = useToast();

  const reload = useCallback(() => setLocal((n) => n + 1), []);

  useEffect(() => {
    setPhrases(null);
    const q = new URLSearchParams({ sort });
    if (favOnly) q.set("favorite", "true");
    A.phrases(q.toString()).then(setPhrases).catch(() => setPhrases([]));
  }, [sort, favOnly, refreshKey, local]);

  const toggleStar = async (p: PhraseCard) => {
    await A.updatePhrase(p.id, { favorite: !p.favorite }).catch(() => {});
    reload();
    refresh();
  };

  const doDelete = async () => {
    if (!deleting) return;
    await A.deletePhrase(deleting.id).catch(() => {});
    setDeleting(null);
    toast("Фраза удалена", "success");
    reload();
    refresh();
  };

  // Мгновенный поиск по загруженным фразам (англ / рус / урок).
  const q = query.trim().toLowerCase();
  const visible =
    phrases && q
      ? phrases.filter(
          (p) =>
            (p.english || "").toLowerCase().includes(q) ||
            (p.russian || "").toLowerCase().includes(q) ||
            (p.lessonTitle || "").toLowerCase().includes(q)
        )
      : phrases;

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="title-hero">
            мои фразы<span className="dim">.</span>
          </div>
        </div>
        <button className="wbtn" onClick={() => setAdding(true)}>＋ Добавить фразу</button>
      </div>

      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по фразам…"
          style={{
            width: "100%",
            minHeight: 44,
            padding: "0 40px 0 16px",
            borderRadius: 14,
            border: "1.5px solid var(--line-soft)",
            background: "var(--panel-2, rgba(255,255,255,0.06))",
            color: "var(--ink)",
            fontSize: 15,
            fontWeight: 600,
            outline: "none",
          }}
        />
        {query && (
          <button
            aria-label="Очистить"
            onClick={() => setQuery("")}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 6 }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <select className="select-onpanel" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button className={favOnly ? "wbtn wbtn-sm" : "gbtn gbtn-sm"} style={{ minHeight: 40 }} onClick={() => setFavOnly((v) => !v)}>
          ★ Только избранное
        </button>
        {favOnly && (
          <button className="gbtn gbtn-sm" style={{ minHeight: 40 }} onClick={() => startStudy({ scope: "favorites" })}>
            Учить избранное
          </button>
        )}
      </div>

      {phrases === null ? (
        <div style={{ display: "grid", placeItems: "center", padding: 50, color: "#fff" }}><Spinner size={24} /></div>
      ) : (visible || []).length === 0 && q ? (
        <EmptyState icon="🔍" title="Ничего не найдено" hint={`По запросу «${query.trim()}» фраз нет.`} />
      ) : phrases.length === 0 ? (
        <EmptyState
          icon={favOnly ? "★" : "🗂️"}
          title={favOnly ? "Нет избранных фраз" : "Пока нет фраз"}
          hint={favOnly ? "Отмечай фразы звёздочкой, чтобы собрать их здесь." : "Добавь первую фразу — потребуется выбрать урок."}
          action={!favOnly ? <button className="abtn" onClick={() => setAdding(true)}>Добавить фразу</button> : undefined}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(visible || []).map((p) => (
            <div key={p.id} className="wcard-sm" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Star active={p.favorite} onClick={() => toggleStar(p)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, color: "var(--ink)", overflowWrap: "anywhere" }}>
                      {p.english || "—"}
                    </span>
                    <span className={`diff-dot diff-${difficultyBand(p.difficulty)}`} style={{ flex: "none" }} />
                  </div>
                  <div style={{ color: "var(--ink-2)", fontSize: 14, overflowWrap: "anywhere" }}>
                    {p.translationStatus === "ready" ? p.russian : p.translationStatus === "pending" ? "Перевод загружается…" : "Перевод не удался"}
                  </div>
                  <div style={{ color: "var(--ink-3)", fontSize: 11, marginTop: 2, fontWeight: 600 }}>{p.lessonTitle}</div>
                </div>
                <button className="icon-btn" aria-label="Редактировать" onClick={() => setEditing(p)}><EditIcon /></button>
                <button className="icon-btn icon-btn-danger" aria-label="Удалить" onClick={() => setDeleting(p)}><TrashIcon /></button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className={`track ${p.known ? "is-known" : ""}`} style={{ flex: 1 }}>
                  <span style={{ width: `${p.progress}%` }} />
                </div>
                <span style={{ color: "var(--ink-2)", fontSize: 11, fontWeight: 700, minWidth: 34, textAlign: "right" }}>{p.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <AddPhraseDialog onClose={() => setAdding(false)} onAdded={() => { reload(); refresh(); }} />}
      {editing && <EditPhraseDialog phrase={editing} onClose={() => setEditing(null)} onSaved={() => { reload(); refresh(); }} />}
      {deleting && (
        <Confirm message={`Удалить фразу «${deleting.english || deleting.russian}»? Действие необратимо.`} onConfirm={doDelete} onCancel={() => setDeleting(null)} />
      )}
    </>
  );
}
