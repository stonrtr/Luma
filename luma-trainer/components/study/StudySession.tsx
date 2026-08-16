"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "@/lib/api";
import type { PhraseCard, Rating } from "@/lib/types";
import { maskAnswer, isFullyRevealed, hintLetterCount } from "@/lib/hint";
import { difficultyBand } from "@/lib/difficulty";
import { prefetchEnglish, speakEnglish } from "@/lib/tts-client";
import { playSfx } from "@/lib/sfx";
import { useApp } from "../app-context";
import type { StudyScope } from "../app-context";
import { Spinner, Star } from "../ui";

// Плитка итога сессии (число + подпись).
function SummaryStat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 30, fontWeight: 800, color }}>{n}</div>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// Иконка-динамик (SVG вместо эмодзи).
function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

// Цвета точки сложности на цветной панели (светлее обычных — по референсу).
const DIFF_ON_PANEL: Record<string, string> = {
  green: "#54e6a1",
  lime: "#c9e35e",
  orange: "#ffb35c",
  red: "#ff8b8b",
};

/**
 * Экран изучения. Два режима:
 * - fullscreen (по умолчанию): собственный оверлей «рамка+панель» («▶ сессия», «Учить урок»);
 * - embedded: карточка рендерится прямо внутри панели раздела «Сегодня», навигация остаётся сверху.
 */
export function StudySession({
  scope,
  onClose,
  embedded = false,
}: {
  scope: StudyScope;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const { settings, refresh, refreshKey, goTo, studyOpen } = useApp();
  const [cards, setCards] = useState<PhraseCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reveal, setReveal] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  // Итог сессии: сколько ответов каждого типа (подсказка считается как «Не вспомнил»).
  const [counts, setCounts] = useState({ easy: 0, hard: 0, again: 0 });
  // «Повторить приближающиеся»: внутренняя подмена scope при пустой очереди.
  const [scopeOverride, setScopeOverride] = useState<"upcoming" | null>(null);
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);
  // Random: по исчерпании списка перезапрашиваем новую перетасовку (бесконечный цикл).
  const [reloadTick, setReloadTick] = useState(0);
  const busy = useRef(false);

  const showFirst = settings.showFirst;
  const card = cards?.[index] ?? null;
  const effScope = scopeOverride ?? scope.scope;

  // Встроенный режим перечитывает очередь после закрытия оверлейной сессии (refreshKey).
  const fetchKey = embedded ? refreshKey : 0;
  useEffect(() => {
    setCards(null);
    setIndex(0);
    setFlipped(false);
    setReveal(0);
    setUsedHint(false);
    A.study(effScope, scope.lessonId)
      .then((r) => setCards(r.cards))
      .catch(() => setCards([]));
  }, [scope, effScope, fetchKey, reloadTick]);

  // Прогрев озвучки: текущая карточка и две следующие — последовательно,
  // чтобы к нажатию 🔊 (или автоозвучке) аудио уже было в кэше.
  useEffect(() => {
    if (!cards) return;
    let cancelled = false;
    void (async () => {
      for (const c of cards.slice(index, index + 3)) {
        if (cancelled) break;
        if (c.english) await prefetchEnglish(c.english, settings.voice);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cards, index, settings.voice]);

  const question = card ? (showFirst === "en" ? card.english : card.russian) : "";
  const answer = card ? (showFirst === "en" ? card.russian : card.english) : "";
  const questionIsEn = showFirst === "en";
  const exampleQ = card ? (questionIsEn ? card.exampleEn : card.exampleRu) : "";
  const exampleOther = card ? (questionIsEn ? card.exampleRu : card.exampleEn) : "";

  const playEnglish = useCallback(() => {
    if (card?.english) speakEnglish(card.english, settings.voice, settings.speechRate);
  }, [card, settings.voice, settings.speechRate]);

  const open = useCallback(() => {
    if (flipped || !card) return;
    playSfx("flip");
    setFlipped(true);
    if (settings.autoPlay) setTimeout(playEnglish, 250);
  }, [flipped, card, settings.autoPlay, playEnglish]);

  const close = useCallback(() => {
    if (!flipped) return;
    playSfx("flip");
    setFlipped(false);
  }, [flipped]);

  const doHint = useCallback(() => {
    if (!answer || flipped) return;
    setUsedHint(true);
    setReveal((r) => Math.min(hintLetterCount(answer), r + 1));
  }, [answer, flipped]);

  const advance = useCallback(() => {
    setFlipped(false);
    setReveal(0);
    setUsedHint(false);
    setFeedback(null);
    const next = index + 1;
    if (effScope === "random" && cards && next >= cards.length) {
      setReloadTick((t) => t + 1); // новая перетасовка вместо экрана «готово»
    } else {
      setIndex(next);
    }
  }, [index, cards, effScope]);

  const grade = useCallback(
    async (rating: Rating) => {
      if (!card || busy.current) return;
      // Подсказка = «Не вспомнил»: открывал буквы — сам не вспомнил.
      const effective: Rating = usedHint ? "again" : rating;
      busy.current = true;
      playSfx(effective === "easy" ? "success" : effective === "hard" ? "so-so" : "mistake");
      setFeedback(effective === "again" ? "bad" : "good");
      setCounts((c) => ({ ...c, [effective]: c[effective] + 1 }));
      try {
        await A.review(card.id, effective, usedHint);
        setReviewedCount((n) => n + 1);
      } catch {
        /* не блокируем сессию при ошибке сохранения */
      }
      const delay = settings.animationsEnabled ? 380 : 0;
      setTimeout(() => {
        busy.current = false;
        advance();
      }, delay);
    },
    [card, usedHint, advance, settings.animationsEnabled]
  );

  // Хоткеи (§6): не срабатывают в полях ввода. Встроенная карточка
  // отключает их, пока открыт полноэкранный оверлей, чтобы не было двойной обработки.
  const keysDisabled = embedded && studyOpen;
  useEffect(() => {
    if (keysDisabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!card) {
        if (e.key === "Escape" && onClose) onClose();
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (flipped) close();
          else open();
          break;
        case "ArrowUp":
          e.preventDefault();
          doHint();
          break;
        case "ArrowLeft":
          if (flipped) grade("again");
          break;
        case "ArrowDown":
          if (flipped) {
            e.preventDefault();
            grade("hard");
          }
          break;
        case "ArrowRight":
          if (flipped) grade("easy");
          break;
        case "Shift":
          playEnglish();
          break;
        case "Escape":
          if (onClose) onClose();
          break;
        default:
          // V — озвучить (учитываем русскую раскладку: клавиша V печатает «м»)
          if (e.key.toLowerCase() === "v" || e.key.toLowerCase() === "м") playEnglish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, flipped, open, close, doHint, grade, playEnglish, onClose, keysDisabled]);

  const toggleStar = async () => {
    if (!card || !cards) return;
    const next = !card.favorite;
    setCards(cards.map((c, i) => (i === index ? { ...c, favorite: next } : c)));
    await A.updatePhrase(card.id, { favorite: next }).catch(() => {});
    // В embedded refresh() перезапустил бы очередь (fetch зависит от refreshKey) — не дёргаем.
    if (!embedded) refresh();
  };

  const title =
    scopeOverride === "upcoming"
      ? "Пока не забыл"
      : scope.scope === "today"
        ? "Сегодня"
        : scope.scope === "favorites"
          ? "Избранное"
          : scope.scope === "random"
            ? "Случайный режим"
            : scope.title || "Урок";

  const total = cards?.length ?? 0;
  const revealText = card ? maskAnswer(answer, reveal) : "";
  const hintDone = card ? isFullyRevealed(answer, reveal) : true;
  const done = cards !== null && !card;
  const emptyFromStart = done && reviewedCount === 0 && total === 0;
  const fbClass = feedback === "good" ? "fb-good" : feedback === "bad" ? "fb-bad" : "";

  // Завершение «Сегодня» (пустая очередь или пройдено всё) → узнаём, есть ли
  // карточки, близкие к забыванию, чтобы предложить повторить их заранее.
  useEffect(() => {
    if (done && !scopeOverride && effScope === "today") {
      A.study("upcoming")
        .then((r) => setUpcomingCount(r.cards.length))
        .catch(() => setUpcomingCount(0));
    }
  }, [done, scopeOverride, effScope]);

  // «На главную» из итога: встроенный режим ремонтируется (сброс счётчиков),
  // полноэкранный — закрывается.
  const goHome = () => {
    if (embedded) refresh();
    else if (onClose) onClose();
  };

  /* ── Общие блоки разметки ─────────────────────────────────────────── */

  const stage = card && (
    <div
      key={`${index}-${flipped ? "b" : "f"}`}
      className="stage"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "clamp(14px, 2.5vh, 26px)",
        textAlign: "center",
        padding: "clamp(16px, 3vh, 32px) 0",
      }}
    >
      {!flipped ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <span className="gpill">
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: DIFF_ON_PANEL[difficultyBand(card.difficulty)],
                  display: "inline-block",
                }}
              />
              сложность {card.difficulty}/10
            </span>
            <button aria-label="Озвучить" className="icon-btn icon-btn-sm" onClick={playEnglish}>
              <SpeakerIcon />
            </button>
          </div>

          <div
            style={{
              fontSize: embedded ? "clamp(40px, 7vw, 110px)" : "clamp(46px, 9vw, 150px)",
              fontWeight: 800,
              color: "#fff",
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              textWrap: "balance",
              maxWidth: "15ch",
            }}
          >
            {question}
          </div>

          {exampleQ && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "flex-start",
                gap: 10,
                maxWidth: 560,
                background: "rgba(255,255,255,0.13)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: 18,
                padding: "12px 18px",
                color: "rgba(255,255,255,0.92)",
                fontSize: "clamp(14px, 1.4vw, 17px)",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  flex: "none",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  marginTop: 1,
                }}
              >
                +
              </span>
              <span style={{ fontStyle: "italic" }}>{exampleQ}</span>
            </div>
          )}

          {/* Действия сразу под фразой: Подсказка (слева), Показать ответ (справа) */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            <button className="gbtn" style={{ minHeight: 34, padding: "0 18px", fontSize: 11 }} onClick={doHint} disabled={hintDone}>
              Подсказка ↑
            </button>
            <button className="wbtn" style={{ minHeight: 34, padding: "0 20px", fontSize: 11 }} onClick={open}>
              Показать ответ
            </button>
          </div>

          {reveal > 0 && (
            <div
              style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.16)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.28)",
                borderRadius: 999,
                padding: "10px 26px",
                color: "#fff",
                fontWeight: 700,
                fontSize: "clamp(18px, 2.6vw, 30px)",
                letterSpacing: 3,
              }}
            >
              {revealText}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "clamp(16px, 1.8vw, 22px)", fontWeight: 600 }}>{question}</div>
          <div
            style={{
              fontSize: embedded ? "clamp(34px, 5.5vw, 90px)" : "clamp(38px, 7vw, 110px)",
              fontWeight: 800,
              color: "#fff",
              lineHeight: 0.98,
              letterSpacing: "-0.02em",
              textWrap: "balance",
              maxWidth: "18ch",
            }}
          >
            {answer}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {card.transcription && (
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: 600 }}>{card.transcription}</span>
            )}
            {card.alternativeTranslations.length > 0 && (
              <span className="gpill" style={{ color: "rgba(255,255,255,0.85)", padding: "5px 14px" }}>
                {card.alternativeTranslations.join(" · ")}
              </span>
            )}
          </div>
          {(exampleQ || exampleOther) && (
            <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 6 }}>
              {exampleQ && (
                <div style={{ color: "rgba(255,255,255,0.9)", fontStyle: "italic", fontSize: "clamp(14px, 1.4vw, 17px)" }}>{exampleQ}</div>
              )}
              {exampleOther && (
                <div style={{ color: "rgba(255,255,255,0.65)", fontStyle: "italic", fontSize: "clamp(13px, 1.3vw, 15px)" }}>{exampleOther}</div>
              )}
            </div>
          )}
          {usedHint ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 8 }}>
              <span className="gpill" style={{ fontSize: 13 }}>подсказка использована — засчитывается как «Не вспомнил»</span>
              <button
                className="wbtn"
                style={{ minHeight: 52, padding: "0 30px", fontSize: 16, color: "#d6403f" }}
                onClick={() => grade("again")}
              >
                Не вспомнил →
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
              <button
                className="wbtn"
                style={{ minHeight: 52, padding: "0 26px", fontSize: 16, color: "#d6403f" }}
                onClick={() => grade("again")}
              >
                ← Не вспомнил
              </button>
              <button className="gbtn" style={{ minHeight: 52, padding: "0 26px", fontSize: 16 }} onClick={() => grade("hard")}>
                ↓ С трудом
              </button>
              <button className="wbtn" style={{ minHeight: 52, padding: "0 30px", fontSize: 16 }} onClick={() => grade("easy")}>
                Легко →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const bottomBar = card && (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div className="kbd-hints" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 500, letterSpacing: "0.04em" }}>
          Space — ответ · ↑ — подсказка · V — озвучить · ← ↓ → — оценка
        </div>
      </div>

      <div className="wcard session-progress" style={{ padding: "18px 22px", width: "min(300px, 100%)" }}>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>Прогресс фразы</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 500, margin: "6px 0 12px" }}>
          {card.known ? "выучено" : `${Math.round(card.progress)}%`} · повторений этой фразы: {card.reviewCount}
        </div>
        <div className={`track ${card.known ? "is-known" : ""}`} style={{ height: 9 }}>
          <span style={{ width: `${card.progress}%` }} />
        </div>
      </div>
    </div>
  );

  const circles = card && (
    <>
      <button
        aria-label="Перевернуть"
        className={`flip-circle ${settings.animationsEnabled ? "bob" : ""}`}
        style={{
          position: "absolute",
          left: "50%",
          bottom: 14,
          transform: "translateX(-50%)",
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--dark-cta)",
          border: "none",
          color: "#fff",
          fontSize: 20,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 14px 34px rgba(2,14,70,0.5)",
        }}
        onClick={() => (flipped ? close() : open())}
      >
        ↓
      </button>
    </>
  );

  const loading = cards === null && (
    <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#fff", minHeight: 200 }}>
      <Spinner size={30} />
    </div>
  );

  const startUpcoming = () => {
    setUpcomingCount(null);
    setScopeOverride("upcoming");
  };

  const doneBlock = done && (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 18, textAlign: "center", padding: "clamp(20px, 5vh, 50px) 0" }}>
      <div className="overline" style={{ color: "rgba(255,255,255,0.55)" }}>
        {emptyFromStart ? "Очередь пуста" : "Сессия завершена"}
      </div>
      <div style={{ fontSize: "clamp(48px, 9vw, 140px)", fontWeight: 800, color: "#fff", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
        {emptyFromStart ? "на сегодня всё" : "готово"}
        <span className="dim">.</span>
      </div>

      {emptyFromStart ? (
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "clamp(16px, 2vw, 22px)", fontWeight: 600, maxWidth: 520 }}>
          {upcomingCount && upcomingCount > 0
            ? "Очередь пуста, но можно закрепить фразы, которые скоро начнут забываться."
            : "Очередь повторения пуста. Загляни в уроки для дополнительного занятия."}
        </div>
      ) : (
        <>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "clamp(16px, 2vw, 22px)", fontWeight: 600 }}>
            Повторено карточек: {reviewedCount}
          </div>
          <div className="wcard" style={{ display: "flex", gap: 8, padding: "18px 20px", width: "min(440px, 100%)" }}>
            <SummaryStat n={counts.easy} label="Легко" color="var(--success)" />
            <SummaryStat n={counts.hard} label="С трудом" color="var(--warning)" />
            <SummaryStat n={counts.again} label="Не вспомнил" color="var(--danger)" />
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
        {(upcomingCount ?? 0) > 0 && (
          <button className="wbtn wbtn-lg" onClick={startUpcoming}>
            Пока не забыл ({upcomingCount})
          </button>
        )}
        <button
          className={(upcomingCount ?? 0) > 0 ? "gbtn" : "wbtn wbtn-lg"}
          style={{ minHeight: 56, padding: "0 28px", fontSize: 16 }}
          onClick={goHome}
        >
          На главную
        </button>
        {emptyFromStart && (upcomingCount ?? 0) === 0 && (
          <button
            className="gbtn"
            style={{ minHeight: 56, padding: "0 24px", fontSize: 16 }}
            onClick={() => {
              goTo("lessons");
              if (!embedded && onClose) onClose();
            }}
          >
            Открыть уроки
          </button>
        )}
      </div>
    </div>
  );

  /* ── Встроенный режим («Сегодня») ─────────────────────────────────── */
  if (embedded) {
    return (
      <div
        className={fbClass}
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: "clamp(14px, 2.5vh, 24px)", position: "relative" }}
      >
        {card && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="gpill" style={{ minHeight: 30, padding: "0 12px", fontSize: 10, color: "#fff" }}>
              {card.lessonTitle || title}
            </span>
            <span style={{ flex: 1 }} />
            <span className="wbtn" style={{ cursor: "default", fontSize: 10, minHeight: 30, padding: "0 16px" }}>
              {Math.min(index + 1, Math.max(total, 1))} / {Math.max(total, 1)}
            </span>
            <Star active={card.favorite} onClick={toggleStar} onPanel />
          </div>
        )}
        {loading}
        {stage}
        {bottomBar}
        {circles}
        {doneBlock}
      </div>
    );
  }

  /* ── Полноэкранный режим (свой градиент на весь экран) ────────────── */
  return (
    <div
      className={`app-outer ${fbClass}`}
      style={{ position: "fixed", inset: 0, zIndex: 50, overflowY: "auto", gap: "clamp(18px, 3vh, 28px)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="gbtn" onClick={onClose}>✕ выйти</button>
          {card && (
            <span className="gpill" style={{ minHeight: 46, padding: "0 20px", fontSize: 14 }}>
              {card.lessonTitle || title}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <div className="brand" style={{ fontSize: "clamp(22px, 3vw, 30px)" }}>
            luma<span className="dim">.</span>
          </div>
          <div className="brand-sub" style={{ letterSpacing: "0.18em" }}>Session</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {card && (
            <button aria-label="Озвучить" className="icon-btn" style={{ width: 46, height: 46 }} onClick={playEnglish}>
              <SpeakerIcon />
            </button>
          )}
          <span className="wbtn" style={{ cursor: "default", fontSize: 15 }}>
            {Math.min(index + 1, Math.max(total, 1))} / {Math.max(total, 1)}
          </span>
        </div>
      </div>

      {/* обёртка для позиционирования круглых кнопок и вертикального центрирования */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", gap: "clamp(18px, 3vh, 28px)" }}>
        {loading}
        {stage}
        {bottomBar}
        {circles}
        {doneBlock}
      </div>
    </div>
  );
}
