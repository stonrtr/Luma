"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "@/lib/api";
import type { GrammarRule, RuleExercise } from "@/lib/types";
import { checkAnswer } from "@/lib/answerCheck";
import { Confirm, EmptyState, Spinner, useToast } from "../ui";

export function RulesSection() {
  const toast = useToast();
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [rules, setRules] = useState<GrammarRule[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [local, setLocal] = useState(0);
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

  const create = async () => {
    if (!query.trim()) return;
    setCreating(true);
    try {
      await A.createRule(query.trim());
      setQuery("");
      toast("Правило создаётся…", "info");
      reload();
    } catch (e) {
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="title-hero">
        правила<span className="dim">.</span>
      </div>

      <div className="wcard" style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200, minHeight: 46, fontSize: 15 }}
          placeholder="Напр. «Present Perfect» или «разница между say и tell»"
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
          hint={tab === "archive" ? undefined : "Введи тему грамматики выше — Luma соберёт объяснение, примеры и упражнения."}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rules.map((r) => (
            <RuleCard key={r.id} rule={r} onChanged={reload} />
          ))}
        </div>
      )}
    </>
  );
}

function RuleCard({ rule, onChanged }: { rule: GrammarRule; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false); // аккордеоны закрыты по умолчанию
  const [confirmDel, setConfirmDel] = useState(false);

  const grade = async (rating: string) => {
    try {
      await A.reviewRule(rule.id, rating);
      toast("Прогресс обновлён", "success");
      onChanged();
    } catch (e) {
      toast((e as Error).message || "Ошибка", "error");
    }
  };

  return (
    <div className="wcard" style={{ padding: 0, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
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
          <RuleBody rule={rule} />
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

function RuleBody({ rule }: { rule: GrammarRule }) {
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
        <Block title="Примеры">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rule.examples.map((e, i) => (
              <div key={i}>
                <div style={{ fontWeight: 700, color: "var(--ink)" }}>{e.en}</div>
                <div style={{ color: "var(--ink-2)", fontSize: 14 }}>{e.ru}</div>
              </div>
            ))}
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

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-2)", marginBottom: 6 }}>{title}</div>
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
                : { background: "#fff", color: "#4a5878", border: "1px solid var(--line)" };
            return (
              <button
                key={o}
                style={{ minHeight: 38, padding: "0 20px", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer", ...style }}
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
            style={{ flex: 1, minWidth: 180, background: "#fff", border: "1px solid var(--line)" }}
            value={input}
            onChange={(e) => { setInput(e.target.value); setState("idle"); }}
            onKeyDown={(e) => e.key === "Enter" && check(input)}
            placeholder="Ваш ответ"
          />
          <button className="abtn" style={{ minHeight: 38, fontSize: 14 }} onClick={() => check(input)}>Проверить</button>
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
