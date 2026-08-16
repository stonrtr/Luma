"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "@/lib/api";
import type { GrammarRule, RuleExercise } from "@/lib/types";
import { CEFR_CATALOG } from "@/lib/cefr";
import { checkAnswer } from "@/lib/answerCheck";
import { useApp } from "../app-context";
import { Confirm, EmptyState, Spinner, useToast } from "../ui";

export function RulesSection() {
  const toast = useToast();
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [rules, setRules] = useState<GrammarRule[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [local, setLocal] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null); // какой аккордеон раскрыт
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(() => setLocal((n) => n + 1), []);

  useEffect(() => {
    setRules(null);
    A.rules(tab === "archive").then(setRules).catch(() => setRules([]));
  }, [tab, local]);

  useEffect(() => {
    const anyPending = rules?.some((r) => r.status === "pending");
    if (anyPending && !pollRef.current) {
      pollRef.current = setInterval(() => reload(), 2500);
    } else if (!anyPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [rules, reload]);

  const createRule = async (q: string) => {
    setCreating(true);
    try {
      await A.createRule(q.trim());
      toast("Правило создаётся…", "info");
      reload();
    } catch (e) {
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setCreating(false);
    }
  };

  const create = async () => {
    if (!query.trim()) return;
    await createRule(query.trim());
    setQuery("");
  };

  // Клик по теме каталога: если правило уже есть (по query) — открыть его, иначе создать.
  const pickTopic = (topic: string) => {
    const existing = rules?.find((r) => r.query === topic);
    if (existing) {
      setTab("active");
      setOpenId(existing.id);
      setTimeout(() => document.getElementById(`rule-${existing.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    } else {
      createRule(topic);
    }
  };

  return (
    <>
      <div>
        <div className="overline" style={{ marginBottom: 12 }}>Грамматика</div>
        <div className="title-hero">
          правила<span className="dim">.</span>
        </div>
      </div>

      <Catalog rules={rules} onPick={pickTopic} />

      <div className="wcard" style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200, minHeight: 46, fontSize: 15 }}
          placeholder="Своя тема: напр. «разница между say и tell»"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <button className="abtn" style={{ minHeight: 46, padding: "0 24px", fontSize: 15 }} onClick={create} disabled={creating || !query.trim()}>
          {creating ? <Spinner /> : "Создать правило"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button className={tab === "active" ? "wbtn wbtn-sm" : "gbtn gbtn-sm"} onClick={() => setTab("active")}>Активные</button>
        <button className={tab === "archive" ? "wbtn wbtn-sm" : "gbtn gbtn-sm"} onClick={() => setTab("archive")}>Архив</button>
      </div>

      {rules === null ? (
        <div style={{ display: "grid", placeItems: "center", padding: 50, color: "#fff" }}><Spinner size={24} /></div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon="📐"
          title={tab === "archive" ? "Архив пуст" : "Пока нет правил"}
          hint={tab === "archive" ? undefined : "Выбери тему из каталога по уровням выше или введи свою — Luma соберёт объяснение, примеры и упражнения."}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rules.map((r) => (
            <RuleCard
              key={r.id}
              rule={r}
              open={openId === r.id}
              onToggle={() => setOpenId((id) => (id === r.id ? null : r.id))}
              onChanged={reload}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ── Каталог тем по уровням CEFR ─────────────────────────────────────────── */
function Catalog({ rules, onPick }: { rules: GrammarRule[] | null; onPick: (topic: string) => void }) {
  const [open, setOpen] = useState(true);
  const has = (topic: string) => !!rules?.some((r) => r.query === topic);

  return (
    <div className="wcard" style={{ padding: 0, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
      >
        <span style={{ fontSize: 18, color: "var(--ink-2)" }}>{open ? "▾" : "▸"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>Каталог тем по уровням</div>
          <div style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 2 }}>от A2 до C2 — выбери тему, чтобы изучить с примерами</div>
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", flexDirection: "column", gap: 16 }}>
          {CEFR_CATALOG.map((lvl) => (
            <div key={lvl.level} style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span className="chip chip-accent" style={{ fontWeight: 800, letterSpacing: "0.05em" }}>{lvl.level}</span>
                <span style={{ color: "var(--ink-2)", fontSize: 13, fontWeight: 600 }}>{lvl.caption}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {lvl.topics.map((t) => {
                  const done = has(t);
                  return (
                    <button
                      key={t}
                      className={done ? "chip chip-green" : "lbtn"}
                      style={{ cursor: "pointer", fontSize: 13, ...(done ? { padding: "6px 12px" } : {}) }}
                      onClick={() => onPick(t)}
                      title={done ? "Уже создано — открыть" : "Создать правило по этой теме"}
                    >
                      {done ? "✓ " : "＋ "}{t}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RuleCard({ rule, open, onToggle, onChanged }: { rule: GrammarRule; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { refresh } = useApp();
  const [confirmDel, setConfirmDel] = useState(false);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  const grade = async (rating: string) => {
    try {
      await A.reviewRule(rule.id, rating);
      toast("Прогресс обновлён", "success");
      onChanged();
    } catch (e) {
      toast((e as Error).message || "Ошибка", "error");
    }
  };

  // Найти/создать урок под грамматику этого правила (тема «Грамматика»).
  const ensureGrammarLesson = async (): Promise<string> => {
    const topics = await A.topics();
    let topic = topics.find((t) => t.name === "Грамматика");
    if (!topic) topic = await A.createTopic("Грамматика");
    const lessons = await A.lessons(false);
    let lesson = lessons.find((l) => l.title === rule.title && l.topicId === topic!.id);
    if (!lesson) lesson = await A.createLesson({ title: rule.title, topicId: topic.id });
    return lesson.id;
  };

  const addExample = async (en: string, ru: string) => {
    const key = en + "|" + ru;
    if (addedKeys.has(key)) return;
    try {
      const lessonId = await ensureGrammarLesson();
      await A.createPhrase({ lessonId, english: en, russian: ru, source: { type: "manual" } });
      setAddedKeys((s) => new Set(s).add(key));
      toast("В карточки: " + en, "success");
      refresh();
    } catch (e) {
      toast((e as Error).message || "Не удалось добавить", "error");
    }
  };

  const addAllExamples = async () => {
    try {
      const lessonId = await ensureGrammarLesson();
      let n = 0;
      const next = new Set(addedKeys);
      for (const e of rule.examples) {
        const key = e.en + "|" + e.ru;
        if (next.has(key) || !e.en) continue;
        await A.createPhrase({ lessonId, english: e.en, russian: e.ru, source: { type: "manual" } });
        next.add(key);
        n++;
      }
      setAddedKeys(next);
      toast(n ? `Добавлено в карточки: ${n}` : "Все примеры уже добавлены", n ? "success" : "info");
      refresh();
    } catch (e) {
      toast((e as Error).message || "Не удалось добавить", "error");
    }
  };

  return (
    <div id={`rule-${rule.id}`} className="wcard" style={{ padding: 0, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "18px 20px", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
      >
        <span style={{ fontSize: 18, color: "var(--ink-2)" }}>{open ? "▾" : "▸"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>{rule.title}</div>
          <div style={{ marginTop: 4 }}>
            {rule.status === "pending" && <span className="chip chip-accent">⏳ генерируется…</span>}
            {rule.status === "failed" && <span className="chip chip-danger">ошибка генерации</span>}
            {rule.status === "ready" && <span className="chip chip-green">{rule.exercises.length} упражнений</span>}
          </div>
        </div>
        <div style={{ width: 100 }}>
          <div className={`track ${rule.known ? "is-known" : ""}`}>
            <span style={{ width: `${rule.progress}%` }} />
          </div>
        </div>
      </button>

      {open && rule.status === "ready" && (
        <div style={{ padding: "0 22px 22px", borderTop: "1px solid var(--line-soft)", display: "flex", flexDirection: "column", gap: 14 }}>
          <RuleBody rule={rule} addedKeys={addedKeys} onAddExample={addExample} onAddAll={addAllExamples} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: "var(--ink-2)", fontSize: 13, fontWeight: 600 }}>Оцени, как помнишь правило:</span>
            <button className="lbtn lbtn-danger" onClick={() => grade("again")}>Не вспомнил</button>
            <button className="lbtn" onClick={() => grade("hard")}>С трудом</button>
            <button className="abtn" style={{ minHeight: 36, fontSize: 13, padding: "0 18px" }} onClick={() => grade("easy")}>Легко</button>
            <span style={{ flex: 1 }} />
            <button className="lbtn" onClick={() => A.updateRule(rule.id, { archived: !rule.archived }).then(onChanged)}>
              {rule.archived ? "Восстановить" : "Архивировать"}
            </button>
            <button className="lbtn lbtn-danger" onClick={() => setConfirmDel(true)}>Удалить</button>
          </div>
        </div>
      )}
      {open && rule.status !== "ready" && (
        <div style={{ padding: "14px 22px 22px", borderTop: "1px solid var(--line-soft)", color: "var(--ink-2)" }}>
          {rule.status === "pending" ? "Правило генерируется, обычно занимает несколько секунд…" : "Не удалось сгенерировать правило. Попробуйте создать заново."}
        </div>
      )}

      {confirmDel && (
        <Confirm message={`Удалить правило «${rule.title}»?`} onConfirm={() => { setConfirmDel(false); A.deleteRule(rule.id).then(onChanged); }} onCancel={() => setConfirmDel(false)} />
      )}
    </div>
  );
}

function RuleBody({
  rule,
  addedKeys,
  onAddExample,
  onAddAll,
}: {
  rule: GrammarRule;
  addedKeys: Set<string>;
  onAddExample: (en: string, ru: string) => void;
  onAddAll: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
      {rule.explanation && <p style={{ margin: 0, lineHeight: 1.6, color: "var(--ink-body)" }}>{rule.explanation}</p>}
      {rule.formula && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 14,
            fontFamily: "ui-monospace, monospace",
            fontSize: 15,
            background: "color-mix(in srgb, var(--accent) 7%, #ffffff)",
            color: "var(--ink)",
            fontWeight: 600,
          }}
        >
          {rule.formula}
        </div>
      )}
      {rule.uses.length > 0 && (
        <Block title="Когда использовать">
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--ink-body)", lineHeight: 1.6 }}>
            {rule.uses.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        </Block>
      )}
      {rule.examples.length > 0 && (
        <Block
          title="Примеры"
          action={
            <button className="lbtn" style={{ minHeight: 30, fontSize: 12 }} onClick={onAddAll}>
              ＋ все в карточки
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rule.examples.map((e, i) => {
              const added = addedKeys.has(e.en + "|" + e.ru);
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--ink)" }}>{e.en}</div>
                    <div style={{ color: "var(--ink-2)", fontSize: 14 }}>{e.ru}</div>
                  </div>
                  <button
                    className={added ? "chip chip-green" : "icon-btn icon-btn-sm"}
                    style={{ flex: "none", cursor: added ? "default" : "pointer", ...(added ? { height: 34 } : {}) }}
                    disabled={added}
                    aria-label="Добавить в карточки"
                    title={added ? "Уже в карточках" : "Добавить фразу в карточки"}
                    onClick={() => onAddExample(e.en, e.ru)}
                  >
                    {added ? "✓" : "＋"}
                  </button>
                </div>
              );
            })}
          </div>
        </Block>
      )}
      {rule.markers.length > 0 && (
        <Block title="Маркеры">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{rule.markers.map((m, i) => <span key={i} className="chip">{m}</span>)}</div>
        </Block>
      )}
      {rule.mistakes.length > 0 && (
        <Block title="Типичные ошибки">
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--ink-body)", lineHeight: 1.6 }}>
            {rule.mistakes.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </Block>
      )}
      {rule.comparison && (
        <Block title="Сравнение">
          <p style={{ margin: 0, color: "var(--ink-body)" }}>{rule.comparison}</p>
        </Block>
      )}
      {rule.exercises.length > 0 && (
        <Block title="Упражнения">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rule.exercises.map((ex) => <ExerciseView key={ex.id} ex={ex} />)}
          </div>
        </Block>
      )}
    </div>
  );
}

function Block({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-2)" }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ExerciseView({ ex }: { ex: RuleExercise }) {
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "correct" | "wrong">("idle");
  const [showAns, setShowAns] = useState(false);

  const check = (value: string) => {
    const ok = checkAnswer(value, ex.answers);
    setState(ok ? "correct" : "wrong");
  };

  return (
    <div style={{ background: "var(--bg-block)", borderRadius: 18, padding: 16 }}>
      <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>{ex.prompt}</div>

      {ex.type === "choice" || ex.type === "identify" ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ex.options.map((o) => {
            const isPicked = picked === o;
            const isCorrect = checkAnswer(o, ex.answers);
            const style: React.CSSProperties =
              state !== "idle" && isPicked
                ? { background: isCorrect ? "var(--success)" : "var(--danger)", color: "#fff", border: "none" }
                : { background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.22)" };
            return (
              <button
                key={o}
                style={{ minHeight: 40, padding: "0 20px", borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: "pointer", ...style }}
                onClick={() => {
                  setPicked(o);
                  check(o);
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ex.type === "order" && ex.options.length > 0 && (
            <div style={{ color: "var(--ink-2)", fontSize: 13, width: "100%" }}>Слова: {ex.options.join(" · ")}</div>
          )}
          <input
            className="input"
            style={{ flex: 1, minWidth: 180 }}
            value={input}
            onChange={(e) => { setInput(e.target.value); setState("idle"); }}
            onKeyDown={(e) => e.key === "Enter" && check(input)}
            placeholder="Ваш ответ"
          />
          <button className="abtn" style={{ minHeight: 44, fontSize: 14 }} onClick={() => check(input)}>Проверить</button>
        </div>
      )}

      {state === "correct" && <div style={{ color: "var(--success)", fontWeight: 800, marginTop: 10 }}>✓ Верно!</div>}
      {state === "wrong" && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: "var(--danger)", fontWeight: 800 }}>✗ Неверно</div>
          <button className="lbtn" style={{ marginTop: 6 }} onClick={() => setShowAns((v) => !v)}>{showAns ? "Скрыть ответ" : "Показать ответ"}</button>
          {showAns && <div style={{ color: "var(--ink-2)", marginTop: 6 }}>Ответ: <b>{ex.answers[0]}</b></div>}
        </div>
      )}
      {state !== "idle" && ex.explanation && <div style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 8 }}>{ex.explanation}</div>}
    </div>
  );
}
