"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "@/lib/api";
import type { PhraseCard } from "@/lib/types";
import { useApp, type StudyScope } from "../app-context";
import { playSfx, primeSfx } from "@/lib/sfx";
import { speakEnglish, stopAudio } from "@/lib/tts-client";
import { Spinner, EmptyState } from "../ui";

// Режим «Заучивание» (как Learn в Quizlet). Каждый термин проходит две ступени:
//   box 0 → вопрос с выбором (4 варианта) → верно → box 1
//   box 1 → ввод ответа с клавиатуры       → верно → box 2 = освоено
// Ошибка или «Не уверены?» откатывает термин в box 0. Прогресс — освоено/всего.

type Box = 0 | 1 | 2;
type CardState = { card: PhraseCard; box: Box; seen: number };
type Phase = "ask" | "correct" | "wrong";

const norm = (s: string): string =>
  s.toLowerCase().trim().replace(/[.,!?;:"'`’]/g, "").replace(/\s+/g, " ");

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Следующий термин: приоритет меньшему box, затем давно не показанным; по возможности не тот же. */
function pickNextId(sts: CardState[], excludeId: string | null): string | null {
  const pending = sts.filter((s) => s.box < 2);
  if (!pending.length) return null;
  const pool = pending.length > 1 && excludeId ? pending.filter((s) => s.card.id !== excludeId) : pending;
  const sorted = [...pool].sort((a, b) => a.box - b.box || a.seen - b.seen);
  return sorted[0].card.id;
}

export function LearnSession({ scope, onClose }: { scope: StudyScope; onClose: () => void }) {
  const { settings, ttsAvailable } = useApp();
  const [all, setAll] = useState<PhraseCard[] | null>(null);
  const [title, setTitle] = useState(scope.title || "");
  const [states, setStates] = useState<CardState[]>([]);
  const [curId, setCurId] = useState<string | null>(null);
  const [options, setOptions] = useState<PhraseCard[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("ask");
  const [picked, setPicked] = useState<string | null>(null); // выбранный вариант (MC) для подсветки
  const [showHint, setShowHint] = useState(false);
  const [streak, setStreak] = useState(0);
  const [done, setDone] = useState(false);
  // Режим текущего вопроса (выбор/ввод) фиксируется при его показе и НЕ меняется
  // во время показа ответа — иначе при неверном вводе box→0 переключал бы экран.
  const [mode, setMode] = useState<"mc" | "typed">("mc");
  const seenCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const speak = useCallback(
    (text: string) => {
      if (ttsAvailable && text) void speakEnglish(text, settings.voice, settings.speechRate);
    },
    [ttsAvailable, settings.voice, settings.speechRate]
  );

  // Загрузка фраз урока и инициализация.
  const init = useCallback((cards: PhraseCard[]) => {
    seenCounter.current = 0;
    const sts = shuffle(cards).map((c) => ({ card: c, box: 0 as Box, seen: 0 }));
    setStates(sts);
    setStreak(0);
    setDone(false);
    const firstId = pickNextId(sts, null);
    setCurId(firstId);
    setPhase("ask");
    setPicked(null);
    setShowHint(false);
    setInput("");
  }, []);

  useEffect(() => {
    if (!scope.lessonId) {
      setAll([]);
      return;
    }
    A.lesson(scope.lessonId)
      .then((r) => {
        setTitle((t) => t || r.lesson.title);
        const usable = r.phrases.filter((p) => p.english?.trim() && p.russian?.trim());
        setAll(usable);
        if (usable.length) init(usable);
      })
      .catch(() => setAll([]));
  }, [scope.lessonId, init]);

  const cur = states.find((s) => s.card.id === curId) || null;
  const total = states.length;

  // Зафиксировать режим при смене вопроса (по box карточки на момент показа).
  useEffect(() => {
    const c = states.find((s) => s.card.id === curId);
    if (c) setMode(c.box >= 1 ? "typed" : "mc");
    // намеренно только по curId: не реагируем на изменение box текущей карточки
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curId]);
  const mastered = states.filter((s) => s.box === 2).length;

  // Варианты для выбора (MC): правильный + 3 дистрактора.
  useEffect(() => {
    if (!cur || mode !== "mc" || phase !== "ask" || !all) return;
    const others = shuffle(all.filter((c) => c.id !== cur.card.id)).slice(0, 3);
    setOptions(shuffle([cur.card, ...others]));
  }, [curId, mode, phase, all]); // eslint-disable-line react-hooks/exhaustive-deps

  // Фокус в поле ввода на новом вопросе с набором.
  useEffect(() => {
    if (mode === "typed" && phase === "ask") inputRef.current?.focus();
  }, [curId, mode, phase]);

  const advance = useCallback(() => {
    stopAudio();
    setStates((sts) => {
      if (!sts.some((s) => s.box < 2)) {
        setDone(true);
        return sts;
      }
      const nextId = pickNextId(sts, curId);
      // отметить показ
      const withSeen = sts.map((s) => (s.card.id === nextId ? { ...s, seen: ++seenCounter.current } : s));
      setCurId(nextId);
      return withSeen;
    });
    setPhase("ask");
    setPicked(null);
    setShowHint(false);
    setInput("");
  }, [curId]);

  // Применить результат: обновить box, серию, звук, озвучку.
  const resolve = useCallback(
    (ok: boolean) => {
      if (!cur) return;
      primeSfx();
      setStates((sts) =>
        sts.map((s) => {
          if (s.card.id !== cur.card.id) return s;
          const nextBox: Box = ok ? ((s.box + 1) as Box) : 0;
          return { ...s, box: nextBox > 2 ? 2 : nextBox };
        })
      );
      setStreak((n) => (ok ? n + 1 : 0));
      setPhase(ok ? "correct" : "wrong");
      playSfx(ok ? "success" : "mistake");
      speak(cur.card.english);
      if (ok) setTimeout(() => advance(), 850);
    },
    [cur, speak, advance]
  );

  const onPickOption = (opt: PhraseCard) => {
    if (phase !== "ask" || !cur) return;
    setPicked(opt.id);
    resolve(opt.id === cur.card.id);
  };

  const onSubmitTyped = () => {
    if (phase !== "ask" || !cur || !input.trim()) return;
    resolve(norm(input) === norm(cur.card.english));
  };

  const onUnsure = () => {
    if (phase !== "ask" || !cur) return;
    setStreak(0);
    setStates((sts) => sts.map((s) => (s.card.id === cur.card.id ? { ...s, box: 0 } : s)));
    setPhase("wrong");
    speak(cur.card.english);
  };

  // Клавиатура: Esc — выход; Enter — ответить/дальше; 1–4 — выбор варианта.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (phase !== "ask") {
        if (e.key === "Enter") {
          e.preventDefault();
          if (phase === "wrong") advance();
        }
        return;
      }
      if (mode === "typed") {
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmitTyped();
        }
        return;
      }
      // MC: цифры 1..4
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) {
        e.preventDefault();
        onPickOption(options[n - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, mode, options, input, advance, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Подсказка для набора: первое слово + прочерки по длине остальных слов.
  const hintText = cur
    ? cur.card.english
        .split(/\s+/)
        .map((w, i) => (i === 0 ? w : "_".repeat(Math.max(2, w.length))))
        .join(" ")
    : "";

  const progress = total ? Math.round((mastered / total) * 100) : 0;

  return (
    <div className="app-outer" style={{ position: "fixed", inset: 0, zIndex: 50, overflowY: "auto", gap: "clamp(16px, 3vh, 26px)" }}>
      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="gbtn" onClick={onClose}>✕ выйти</button>
          <span className="gpill" style={{ minHeight: 46, padding: "0 20px", fontSize: 14 }}>Заучивание · {title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <div className="brand" style={{ fontSize: "clamp(22px, 3vw, 30px)" }}>luma<span className="dim">.</span></div>
          <div className="brand-sub" style={{ letterSpacing: "0.18em" }}>Learn</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {streak >= 2 && (
            <span className="gpill" style={{ minHeight: 46, padding: "0 16px", fontSize: 14 }}>🔥 {streak}</span>
          )}
          <span className="wbtn" style={{ cursor: "default", fontSize: 15, minWidth: 92, justifyContent: "center" }}>
            {mastered} / {Math.max(total, 1)}
          </span>
        </div>
      </div>

      {/* Прогресс освоения */}
      {!done && total > 0 && (
        <div className="track" style={{ height: 10 }}>
          <span style={{ width: `${progress}%` }} />
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {all === null ? (
          <div style={{ display: "grid", placeItems: "center", padding: 40 }}><Spinner size={26} /></div>
        ) : all.length === 0 ? (
          <EmptyState icon="🎓" title="Нечего заучивать" hint="В уроке нет фраз с переводом." />
        ) : done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 54 }}>🏆</div>
            <div style={{ fontWeight: 800, fontSize: 26 }}>Поздравляем! Вы изучили все термины.</div>
            <div className="muted" style={{ fontSize: 16 }}>{total} терминов освоено</div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button className="abtn" onClick={() => all && init(all)}>Пройти заново</button>
              <button className="gbtn" onClick={onClose}>Выйти</button>
            </div>
          </div>
        ) : cur ? (
          <div className="wcard" style={{ maxWidth: 820, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 18, padding: "clamp(20px, 3vw, 34px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="muted" style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.04em" }}>ОПРЕДЕЛЕНИЕ</span>
              {mode === "typed" && (
                <span className="chip" style={{ fontSize: 11 }}>введи перевод по-английски</span>
              )}
            </div>
            <div style={{ fontWeight: 800, fontSize: "clamp(22px, 3.2vw, 32px)", lineHeight: 1.2 }}>{cur.card.russian}</div>

            {/* ВЫБОР ОТВЕТА (box 0) */}
            {mode === "mc" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 4 }}>
                {options.map((opt, i) => {
                  const isAnswer = opt.id === cur.card.id;
                  const isPicked = picked === opt.id;
                  let ring: string | undefined;
                  let bg: string | undefined;
                  if (phase !== "ask") {
                    if (isAnswer) { ring = "2px solid var(--ok, #35c47a)"; bg = "var(--ok-bg, rgba(53,196,122,0.14))"; }
                    else if (isPicked) { ring = "2px solid var(--danger)"; bg = "var(--danger-bg)"; }
                  }
                  return (
                    <button
                      key={opt.id}
                      onClick={() => onPickOption(opt)}
                      disabled={phase !== "ask"}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                        padding: "16px 18px", borderRadius: 16, cursor: phase === "ask" ? "pointer" : "default",
                        background: bg || "var(--glass)", color: "var(--ink)", fontSize: 16, fontWeight: 600,
                        border: ring || "1px solid var(--glass-border)", transition: "border .12s, background .12s",
                      }}
                    >
                      <span style={{ width: 26, height: 26, flex: "none", borderRadius: "50%", background: "rgba(255,255,255,0.14)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{i + 1}</span>
                      {opt.english}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ВВОД ОТВЕТА (box 1) */}
            {mode === "typed" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Ваш ответ</span>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={phase !== "ask"}
                  placeholder="Введите ответ (язык: английский)"
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    width: "100%", minHeight: 54, padding: "0 18px", borderRadius: 14, fontSize: 17,
                    background: phase === "wrong" ? "var(--danger-bg)" : phase === "correct" ? "var(--ok-bg, rgba(53,196,122,0.14))" : "var(--glass)",
                    color: "var(--ink)",
                    border: `2px solid ${phase === "wrong" ? "var(--danger)" : phase === "correct" ? "var(--ok, #35c47a)" : "var(--glass-border-strong)"}`,
                    outline: "none",
                  }}
                />
              </div>
            )}

            {/* Фидбек правильного ответа */}
            {phase === "wrong" && (
              <div className="wcard" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--glass-border)" }}>
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Правильный ответ:</span>
                <span style={{ fontWeight: 800, fontSize: 17 }}>{cur.card.english}</span>
              </div>
            )}
            {phase === "correct" && (
              <div style={{ fontWeight: 800, color: "var(--ok, #35c47a)", fontSize: 16 }}>
                Верно!{streak >= 2 ? ` ${streak} подряд` : ""}
              </div>
            )}

            {/* Нижняя панель */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {mode === "typed" && phase === "ask" && (
                <button className="gbtn gbtn-sm" onClick={() => setShowHint(true)} disabled={showHint}>Показать подсказку</button>
              )}
              {showHint && phase === "ask" && (
                <span className="chip" style={{ fontFamily: "monospace", letterSpacing: "0.1em" }}>{hintText}</span>
              )}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
                {phase === "ask" && (
                  <button className="link-btn" style={{ background: "none", border: "none", color: "var(--accent-soft)", cursor: "pointer", fontWeight: 700, fontSize: 15 }} onClick={onUnsure}>
                    Не уверены?
                  </button>
                )}
                {mode === "typed" && phase === "ask" && (
                  <button className="abtn" onClick={onSubmitTyped} disabled={!input.trim()}>Ответить</button>
                )}
                {phase === "wrong" && (
                  <button className="abtn" onClick={advance}>Продолжить</button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
