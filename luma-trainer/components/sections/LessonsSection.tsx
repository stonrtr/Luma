"use client";
import { useCallback, useEffect, useState } from "react";
import { A } from "@/lib/api";
import type { Lesson, PhraseCard, Topic } from "@/lib/types";
import { difficultyBand } from "@/lib/difficulty";
import { useApp } from "../app-context";
import { Confirm, EmptyState, Modal, Spinner, Star, useToast } from "../ui";
import { AddPhraseDialog } from "../dialogs/AddPhraseDialog";
import { ImportDialog } from "../dialogs/ImportDialog";
import { EditPhraseDialog } from "../dialogs/EditPhraseDialog";

const SORTS: [string, string][] = [
  ["recent", "Недавно открытые"],
  ["attention", "Требуют внимания"],
  ["worst", "Хуже всего изучены"],
  ["stale", "Давно не повторялись"],
  ["new", "Новые"],
  ["title", "По названию"],
  ["count", "По количеству фраз"],
];

export function LessonsSection() {
  const { refreshKey, refresh } = useApp();
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [sort, setSort] = useState("recent");
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [dialog, setDialog] = useState<"create" | "import" | "topics" | null>(null);
  const [local, setLocal] = useState(0);

  const reload = useCallback(() => setLocal((n) => n + 1), []);

  useEffect(() => {
    setLessons(null);
    A.lessons(tab === "archive", sort).then(setLessons).catch(() => setLessons([]));
    A.topics().then(setTopics).catch(() => {});
  }, [tab, sort, refreshKey, local]);

  const grouped =
    lessons && tab === "active"
      ? [
          ...topics
            .map((t) => ({ name: t.name, items: lessons.filter((l) => l.topicId === t.id) }))
            .filter((g) => g.items.length > 0),
          { name: "Без темы", items: lessons.filter((l) => !l.topicId) },
        ].filter((g) => g.items.length > 0)
      : null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="title-hero">
          мои уроки<span className="dim">.</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="gbtn gbtn-sm" style={{ minHeight: 42 }} onClick={() => setDialog("topics")}>Темы</button>
          <button className="gbtn gbtn-sm" style={{ minHeight: 42 }} onClick={() => setDialog("import")}>Импорт</button>
          <button className="wbtn wbtn-sm" style={{ minHeight: 42 }} onClick={() => setDialog("create")}>＋ Урок</button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button className={tab === "active" ? "wbtn wbtn-sm" : "gbtn gbtn-sm"} onClick={() => setTab("active")}>Активные</button>
          <button className={tab === "archive" ? "wbtn wbtn-sm" : "gbtn gbtn-sm"} onClick={() => setTab("archive")}>Архив</button>
        </div>
        {tab === "active" && (
          <select className="select-onpanel" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        )}
      </div>

      {lessons === null ? (
        <div style={{ display: "grid", placeItems: "center", padding: 50, color: "#fff" }}><Spinner size={24} /></div>
      ) : lessons.length === 0 ? (
        <EmptyState
          icon={tab === "archive" ? "🗄️" : "📚"}
          title={tab === "archive" ? "Архив пуст" : "Пока нет уроков"}
          hint={tab === "archive" ? undefined : "Создай урок или импортируй список фраз, чтобы начать."}
          action={tab === "active" ? <button className="abtn" onClick={() => setDialog("create")}>Создать урок</button> : undefined}
        />
      ) : tab === "archive" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lessons.map((l) => (
            <LessonCard key={l.id} lesson={l} topics={topics} onChanged={() => { reload(); refresh(); }} />
          ))}
        </div>
      ) : (
        grouped!.map((g) => (
          <div key={g.name} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ color: "rgba(255,255,255,0.65)", fontWeight: 700, fontSize: 15 }}>{g.name}</div>
            {g.items.map((l) => (
              <LessonCard key={l.id} lesson={l} topics={topics} onChanged={() => { reload(); refresh(); }} />
            ))}
          </div>
        ))
      )}

      {dialog === "create" && <CreateLessonDialog topics={topics} onClose={() => setDialog(null)} onCreated={() => { setDialog(null); reload(); }} />}
      {dialog === "import" && <ImportDialog onClose={() => setDialog(null)} onImported={() => { reload(); refresh(); }} />}
      {dialog === "topics" && <TopicsManager onClose={() => { setDialog(null); reload(); }} />}
    </>
  );
}

function LessonCard({ lesson, topics, onChanged }: { lesson: Lesson; topics: Topic[]; onChanged: () => void }) {
  const { startStudy } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [phrases, setPhrases] = useState<PhraseCard[] | null>(null);
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);
  const [editing, setEditing] = useState<PhraseCard | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const s = lesson.stats;

  const loadPhrases = useCallback(() => {
    A.lesson(lesson.id).then((r) => setPhrases(r.phrases)).catch(() => setPhrases([]));
  }, [lesson.id]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !phrases) loadPhrases();
  };

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      if (msg) toast(msg, "success");
      onChanged();
    } catch (e) {
      toast((e as Error).message || "Ошибка", "error");
    }
  };

  return (
    <div className="wcard">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={toggle}
          aria-label="Раскрыть"
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, padding: 4, color: "var(--ink-2)" }}
        >
          {open ? "▾" : "▸"}
        </button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>{lesson.title}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            <span className="chip">{s.total} фраз</span>
            {s.due > 0 && <span className="chip chip-accent">{s.due} пора повторить</span>}
            <span className="chip">{s.learning} изучается</span>
            <span className="chip chip-green">{s.learned} выучено</span>
          </div>
        </div>
        <div style={{ width: 120 }}>
          <div className="track">
            <span style={{ width: `${s.progress}%` }} />
          </div>
          <div style={{ color: "var(--ink-2)", fontSize: 11, textAlign: "right", marginTop: 3, fontWeight: 700 }}>{s.progress}%</div>
        </div>
        <button
          className="abtn"
          onClick={() => startStudy({ scope: "lesson", lessonId: lesson.id, title: lesson.title })}
          disabled={s.total === 0}
        >
          Учить урок
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--line-soft)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="lbtn" onClick={() => setDialog("add")}>＋ Фраза</button>
            <button className="lbtn" onClick={() => setDialog("import")}>Импорт</button>
            <button className="lbtn" onClick={() => act(() => A.retranslateLesson(lesson.id), "Переводы пересобираются в фоне")}>Пересобрать переводы</button>
            <select
              className="select"
              style={{ width: "auto", minHeight: 34, fontSize: 13, fontWeight: 700, padding: "0 14px" }}
              value={lesson.topicId || ""}
              onChange={(e) => act(() => A.updateLesson(lesson.id, { topicId: e.target.value || null }), "Перемещено")}
            >
              <option value="">Без темы</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button className="lbtn" onClick={() => act(() => A.updateLesson(lesson.id, { archived: !lesson.archived }), lesson.archived ? "Восстановлен" : "В архиве")}>
              {lesson.archived ? "Восстановить" : "Архивировать"}
            </button>
            <button className="lbtn lbtn-danger" onClick={() => setConfirmDel(true)}>Удалить</button>
          </div>

          {phrases === null ? (
            <div style={{ display: "grid", placeItems: "center", padding: 20 }}><Spinner /></div>
          ) : phrases.length === 0 ? (
            <p className="muted" style={{ textAlign: "center", margin: 0 }}>В уроке пока нет фраз.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {phrases.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px" }}>
                  <span className={`diff-dot diff-${difficultyBand(p.difficulty)}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.english || "—"}
                    </div>
                    <div style={{ color: "var(--ink-2)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.translationStatus === "ready" ? p.russian : p.translationStatus === "pending" ? "Перевод загружается…" : "Перевод не удался"}
                    </div>
                  </div>
                  <span style={{ color: "var(--ink-2)", fontSize: 12, width: 38, textAlign: "right", fontWeight: 700 }}>{p.progress}%</span>
                  <Star active={p.favorite} size={18} onClick={() => act(() => A.updatePhrase(p.id, { favorite: !p.favorite }))} />
                  <button className="icon-btn icon-btn-sm" aria-label="Редактировать" onClick={() => setEditing(p)}>✎</button>
                  <button className="icon-btn icon-btn-sm icon-btn-danger" aria-label="Удалить" onClick={() => act(() => A.deletePhrase(p.id), "Удалено")}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {dialog === "add" && <AddPhraseDialog presetLessonId={lesson.id} onClose={() => setDialog(null)} onAdded={() => { loadPhrases(); onChanged(); }} />}
      {dialog === "import" && <ImportDialog presetLessonId={lesson.id} onClose={() => setDialog(null)} onImported={() => { loadPhrases(); onChanged(); }} />}
      {editing && <EditPhraseDialog phrase={editing} onClose={() => setEditing(null)} onSaved={() => { loadPhrases(); onChanged(); }} />}
      {confirmDel && (
        <Confirm
          message={`Удалить урок «${lesson.title}» со всеми фразами? Действие необратимо.`}
          onConfirm={() => { setConfirmDel(false); act(() => A.deleteLesson(lesson.id), "Урок удалён"); }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}

function CreateLessonDialog({ topics, onClose, onCreated }: { topics: Topic[]; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<string>("");
  const [newTopic, setNewTopic] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim()) return toast("Введите название урока", "error");
    setSaving(true);
    try {
      const body: { title: string; topicId?: string; newTopicName?: string } = { title: title.trim() };
      if (topic === "__new__" && newTopic.trim()) body.newTopicName = newTopic.trim();
      else if (topic && topic !== "__new__") body.topicId = topic;
      await A.createLesson(body);
      toast("Урок создан", "success");
      onCreated();
    } catch (e) {
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Новый урок" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="label">Название</label>
          <input className="input" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
        </div>
        <div>
          <label className="label">Тема</label>
          <select className="select" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">Без темы</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            <option value="__new__">➕ Новая тема</option>
          </select>
        </div>
        {topic === "__new__" && <input className="input" placeholder="Название темы" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? <Spinner /> : "Создать"}</button>
        </div>
      </div>
    </Modal>
  );
}

function TopicsManager({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");

  const load = useCallback(() => A.topics().then(setTopics).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    try {
      await A.createTopic(name.trim());
      setName("");
      load();
    } catch (e) {
      toast((e as Error).message || "Ошибка", "error");
    }
  };

  return (
    <Modal title="Темы" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input className="input" placeholder="Новая тема" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn btn-primary" onClick={add}>Добавить</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {topics.map((t) => (
          <TopicRow key={t.id} topic={t} onChanged={load} />
        ))}
        {topics.length === 0 && <p className="muted" style={{ textAlign: "center" }}>Тем пока нет.</p>}
      </div>
    </Modal>
  );
}

function TopicRow({ topic, onChanged }: { topic: Topic; onChanged: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(topic.name);
  const dirty = name !== topic.name;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      <span className="muted" style={{ fontSize: 12, width: 60, textAlign: "center", flex: "none" }}>{topic.lessonCount ?? 0} ур.</span>
      {dirty && (
        <button className="btn btn-sm" onClick={() => A.renameTopic(topic.id, name.trim()).then(onChanged).catch((e) => toast(e.message, "error"))}>✓</button>
      )}
      <button
        className="icon-btn icon-btn-danger"
        onClick={() => A.deleteTopic(topic.id).then(onChanged).catch((e) => toast((e as Error).message || "Нельзя удалить непустую тему", "error"))}
        aria-label="Удалить тему"
      >
        🗑
      </button>
    </div>
  );
}
