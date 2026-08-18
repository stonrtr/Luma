"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { A } from "@/lib/api";
import { useApp } from "../app-context";
import { EmptyState, Spinner, ProgressBar, useToast } from "../ui";
import { AddTopicDialog } from "../dialogs/AddTopicDialog";
import { TopicDetail } from "../dialogs/TopicDetail";
import type { Collection, Knowledge } from "@/lib/types";

export function KnowledgeSection() {
  const { refreshKey, refresh, startStudy } = useApp();
  const toast = useToast();
  const [items, setItems] = useState<Knowledge[] | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all"); // all | none | <collectionId>
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<Knowledge | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filter === "none") params.set("collectionId", "none");
    else if (filter !== "all") params.set("collectionId", filter);
    const [list, cols] = await Promise.all([A.knowledge(params.toString()), A.collections()]);
    setItems(list);
    setCollections(cols);
  }, [q, filter]);

  useEffect(() => {
    setItems(null);
    load().catch(() => setItems([]));
  }, [load, refreshKey]);

  const countByFilter = useMemo(() => items?.length ?? 0, [items]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h1 className="h1" style={{ margin: 0 }}>Мои темы</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {countByFilter > 0 && (
            <button className="btn btn-sm" onClick={() => startStudy({ scope: "all", title: "Все темы" })}>
              Повторить все
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Тема</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          className="input"
          style={{ flex: "1 1 200px", minHeight: 40 }}
          placeholder="Поиск по темам…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="select"
          style={{ flex: "0 1 200px", minHeight: 40 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Все разделы</option>
          <option value="none">Без раздела</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.topicCount != null ? ` (${c.topicCount})` : ""}</option>
          ))}
        </select>
      </div>

      {items === null ? (
        <div style={{ display: "grid", placeItems: "center", padding: 60 }}><Spinner size={28} /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title={q || filter !== "all" ? "Ничего не найдено" : "Добавьте первую тему"}
          hint={q || filter !== "all" ? "Измените запрос или фильтр." : "Вставьте конспект — Recall составит по нему вопрос, а текст сохранит для перечитывания."}
          action={<button className="btn btn-primary" onClick={() => setAdding(true)}>+ Добавить тему</button>}
        />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((k) => (
            <TopicRow key={k.id} k={k} onOpen={() => setDetail(k)} />
          ))}
        </div>
      )}

      {adding && (
        <AddTopicDialog
          collections={collections}
          defaultCollectionId={filter !== "all" && filter !== "none" ? filter : null}
          onClose={() => setAdding(false)}
          onCreated={(k) => {
            setAdding(false);
            refresh();
            if (k.genStatus === "failed") setDetail(k);
          }}
        />
      )}

      {detail && (
        <TopicDetail
          topic={detail}
          collections={collections}
          onClose={() => setDetail(null)}
          onChanged={(u) => { setItems((prev) => prev?.map((x) => (x.id === u.id ? u : x)) ?? prev); setDetail(u); }}
          onDeleted={(id) => { setItems((prev) => prev?.filter((x) => x.id !== id) ?? prev); setDetail(null); toast("Удалено", "info"); }}
        />
      )}
    </div>
  );
}

function isDue(k: Knowledge): boolean {
  return k.reviewCount > 0 && !!k.dueAt && new Date(k.dueAt).getTime() <= Date.now();
}

function TopicRow({ k, onOpen }: { k: Knowledge; onOpen: () => void }) {
  const due = isDue(k);
  return (
    <button className="card card-hover" onClick={onOpen} style={{ padding: 16, textAlign: "left", cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface)", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{k.title}</div>
          <div className="muted" style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {k.question || "Вопрос не сгенерирован"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "none" }}>
          {k.known ? <span className="pill pill-success">Выучено</span>
            : due ? <span className="pill">К повторению</span>
            : <span className="pill pill-muted">{k.progress}%</span>}
          {k.collectionName && <span className="muted" style={{ fontSize: 12 }}>{k.collectionName}</span>}
        </div>
      </div>
      <div style={{ marginTop: 10 }}><ProgressBar value={k.progress} known={k.known} /></div>
    </button>
  );
}
