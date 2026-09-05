"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "@/lib/api";
import type { PhraseCard, Rating } from "@/lib/types";
import { maskAnswer, isFullyRevealed, hintLetterCount } from "@/lib/hint";
import { difficultyBand } from "@/lib/difficulty";
import { nextProgress } from "@/lib/srs";
import { prefetchEnglish, speakEnglish, stopAudio } from "@/lib/tts-client";
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

// Иконка «перемешать».
function ShuffleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

// Перемешивание (Fisher–Yates) — новый массив, исходный не мутируем.
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);
  // Свайп-оценка на мобиле: влево — «Не вспомнил», вправо — «С трудом», вверх — «Легко».
  const [dragDx, setDragDx] = useState(0);
  const [dragDy, setDragDy] = useState(0);
  const [dragAnim, setDragAnim] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef(0);
  const dragDxRef = useRef(0);
  const dragDyRef = useRef(0);
  const dragMoved = useRef(false);
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

  // Закрываем редактирование при смене карточки.
  useEffect(() => { setEditing(false); }, [index]);

  // Встроенный режим перечитывает очередь после закрытия оверлейной сессии (refreshKey).
  const fetchKey = embedded ? refreshKey : 0;
  useEffect(() => {
    setCards(null);
    setIndex(0);
    setFlipped(false);
    setReveal(0);
    setUsedHint(false);
    A.study(effScope, scope.lessonId, scope.filter)
      // «Сегодня» показываем в случайном порядке при первом отображении,
      // чтобы первой не была всегда одна и та же карточка (нужные карточки те же).
      .then((r) => setCards(effScope === "today" ? shuffled(r.cards) : r.cards))
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
  const exampleQ = card ? (questionIsEn ? card.exampleEn : card.exampleRu) : ""; // пример стороны вопроса
  const exampleA = card ? (questionIsEn ? card.exampleRu : card.exampleEn) : ""; // пример стороны ответа
  // Видимая сторона карточки (крупное слово): вопрос до переворота, ответ после.
  const visibleText = flipped ? answer : question;

  // Озвучиваем ТУ сторону, что видна: русскую — по-русски, английскую — по-английски.
  const speakVisible = useCallback(() => {
    if (visibleText) speakEnglish(visibleText, settings.voice, settings.speechRate);
  }, [visibleText, settings.voice, settings.speechRate]);

  const open = useCallback(() => {
    if (flipped || !card) return;
    playSfx("flip");
    stopAudio(); // при листании не доигрываем прошлую сторону
    setFlipped(true);
  }, [flipped, card]);

  const close = useCallback(() => {
    if (!flipped) return;
    playSfx("flip");
    stopAudio();
    setFlipped(false);
    setEditing(false);
  }, [flipped]);

  // Проговаривание видимой стороны при новой карточке и при перевороте.
  useEffect(() => {
    if (!card || !settings.autoPlay) return;
    const text = flipped ? answer : question;
    const t = setTimeout(() => {
      if (text) speakEnglish(text, settings.voice, settings.speechRate);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, flipped, showFirst, settings.autoPlay]);

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
      // Сразу двигаем прогресс-бар текущей карточки (анимация width 0.5s в .track),
      // чтобы был мгновенный отклик на ответ, до перехода к следующей.
      const newProgress = nextProgress(card.progress, effective);
      setCards((cs) => (cs ? cs.map((c, i) => (i === index ? { ...c, progress: newProgress } : c)) : cs));
      try {
        await A.review(card.id, effective, usedHint);
        setReviewedCount((n) => n + 1);
      } catch {
        /* не блокируем сессию при ошибке сохранения */
      }
      // Держим карточку чуть дольше, чтобы движение бара было заметно.
      const delay = settings.animationsEnabled ? 600 : 0;
      setTimeout(() => {
        busy.current = false;
        advance();
      }, delay);
    },
    [card, usedHint, advance, index, settings.animationsEnabled]
  );

  // Свайп-оценка: влево — «Не вспомнил», вправо — «С трудом», вверх — «Легко».
  const SWIPE_TH = 90;
  const resetDrag = () => {
    setDragAnim(true);
    setDragDx(0);
    setDragDy(0);
    dragDxRef.current = 0;
    dragDyRef.current = 0;
  };
  const flyGrade = (rating: Rating, vx: number, vy: number) => {
    const w = typeof window !== "undefined" ? window.innerWidth : 500;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    setDragAnim(true);
    setDragDx(vx * w);
    setDragDy(vy * h);
    setTimeout(() => {
      resetDrag();
      setDragAnim(false);
      grade(rating);
    }, 180);
  };
  const onCardTouchStart = (e: React.TouchEvent) => {
    // Свайп-оценка доступен на любой стороне карточки (и англ., и рус.).
    if (busy.current || editing) return;
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
    dragMoved.current = false;
    setDragAnim(false);
  };
  const onCardTouchMove = (e: React.TouchEvent) => {
    if (dragStartX.current == null) return;
    const dx = e.touches[0].clientX - dragStartX.current;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) dragMoved.current = true;
    dragDxRef.current = dx;
    dragDyRef.current = dy;
    setDragDx(dx);
    setDragDy(dy);
  };
  const onCardTouchEnd = () => {
    if (dragStartX.current == null) return;
    dragStartX.current = null;
    const dx = dragDxRef.current;
    const dy = dragDyRef.current;
    // Вверх (преобладает вертикаль) → «Легко».
    if (dy <= -SWIPE_TH && Math.abs(dy) >= Math.abs(dx)) flyGrade("easy", 0, -1);
    else if (dx <= -SWIPE_TH) flyGrade("again", -1, 0);
    else if (dx >= SWIPE_TH) flyGrade("hard", 1, 0);
    else resetDrag();
  };

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
          speakVisible();
          break;
        case "Escape":
          if (onClose) onClose();
          break;
        default:
          // V — озвучить (учитываем русскую раскладку: клавиша V печатает «м»)
          if (e.key.toLowerCase() === "v" || e.key.toLowerCase() === "м") speakVisible();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, flipped, open, close, doHint, grade, speakVisible, onClose, keysDisabled]);

  const toggleStar = async () => {
    if (!card || !cards) return;
    const next = !card.favorite;
    setCards(cards.map((c, i) => (i === index ? { ...c, favorite: next } : c)));
    await A.updatePhrase(card.id, { favorite: next }).catch(() => {});
    // В embedded refresh() перезапустил бы очередь (fetch зависит от refreshKey) — не дёргаем.
    if (!embedded) refresh();
  };

  // Выбор основного перевода (первые 2 показа карточки с вариантами): выбранный
  // становится основным, остальные варианты убираются и больше не показываются.
  const chooseTranslation = async (chosen: string) => {
    if (!card || !cards) return;
    playSfx("flip");
    setCards(cards.map((c, i) => (i === index ? { ...c, russian: chosen, alternativeTranslations: [] } : c)));
    await A.updatePhrase(card.id, { russian: chosen, alternativeTranslations: [] }).catch(() => {});
  };

  // Ручная правка перевода: новый становится основным, прежний перевод и старые
  // варианты сохраняются в alternativeTranslations — чтобы можно было вернуться.
  const saveEdit = async (val: string) => {
    if (!card || !cards) return;
    const v = val.trim();
    if (!v || v === card.russian) { setEditing(false); return; }
    const alts = Array.from(new Set([card.russian, ...card.alternativeTranslations]))
      .filter((t) => t && t !== v)
      .slice(0, 4);
    playSfx("flip");
    setCards(cards.map((c, i) => (i === index ? { ...c, russian: v, alternativeTranslations: alts } : c)));
    setEditing(false);
    await A.updatePhrase(card.id, { russian: v, alternativeTranslations: alts }).catch(() => {});
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

  // Перемешать текущую очередь и начать с начала.
  const reshuffle = () => {
    if (!cards || cards.length < 2) return;
    playSfx("flip");
    setCards(shuffled(cards));
    setIndex(0);
    setFlipped(false);
    setReveal(0);
    setUsedHint(false);
    setFeedback(null);
  };

  /* ── Общие блоки разметки ─────────────────────────────────────────── */

  // Строка «сложность + озвучка» — одинаково на обеих сторонах (верхний ряд).
  const topRow = card && (
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
      <button aria-label="Озвучить" className="icon-btn icon-btn-sm" onClick={speakVisible}>
        <SpeakerIcon />
      </button>
    </div>
  );

  // Карточка — сетка из 3 рядов (1fr auto 1fr): главное слово всегда в центре,
  // поэтому при перевороте перевод оказывается ровно там же, где было англ. слово.
  const stage = card && (
    <div
      key={`${index}-${flipped ? "b" : "f"}`}
      className="stage study-card"
      style={{
        position: "relative",
        flex: 1,
        display: "grid",
        // minmax(0,1fr) держит верх и низ строго равными → слово всегда точно по центру,
        // независимо от объёма контента (синонимы, примеры) сверху/снизу.
        gridTemplateRows: "minmax(0, 1fr) auto minmax(0, 1fr)",
        justifyItems: "center",
        alignItems: "center",
        rowGap: "clamp(10px, 2vh, 18px)",
        textAlign: "center",
        padding: "clamp(20px, 3.5vh, 40px) clamp(18px, 4vw, 40px)",
        border: "1.5px dashed rgba(255,255,255,0.35)",
        borderRadius: 28,
        cursor: "pointer",
        transform: dragDx || dragDy ? `translate(${dragDx}px, ${dragDy}px) rotate(${dragDx * 0.05}deg)` : undefined,
        transition: dragAnim ? "transform 0.2s ease" : "none",
        touchAction: "none",
      }}
      onTouchStart={onCardTouchStart}
      onTouchMove={onCardTouchMove}
      onTouchEnd={onCardTouchEnd}
      onClick={(e) => {
        // Тап/клик по карточке переворачивает её. Клики по кнопкам и полям — не трогаем.
        if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
        if (dragMoved.current) { dragMoved.current = false; return; } // это был свайп, не тап
        if (flipped) close();
        else open();
      }}
    >
      {/* Кнопка «Ред.» — правый верхний угол карточки (обе стороны). */}
      <button
        className="gbtn"
        style={{ position: "absolute", top: 12, right: 12, minHeight: 30, padding: "0 12px", fontSize: 12, zIndex: 3 }}
        onClick={() => { setEditVal(card.russian); setEditing(true); }}
      >
        ✎ Ред.
      </button>

      {/* Оверлей редактирования перевода — поверх карточки, без переворота. */}
      {editing && (
        <div
          onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) setEditing(false); }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "24px 18px",
            background: "rgba(6, 24, 90, 0.86)",
            backdropFilter: "blur(8px)",
            borderRadius: 28,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>
            Выберите перевод или введите свой
          </span>
          {Array.from(new Set([card.russian, ...card.alternativeTranslations])).length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 520 }}>
              {Array.from(new Set([card.russian, ...card.alternativeTranslations])).map((t) => {
                const primary = t === card.russian;
                return (
                  <button
                    key={t}
                    onClick={() => saveEdit(t)}
                    className="gpill"
                    style={{
                      cursor: "pointer",
                      padding: "8px 16px",
                      fontSize: 14,
                      fontWeight: 700,
                      color: primary ? "var(--deep)" : "#fff",
                      background: primary ? "#fff" : "var(--glass)",
                      border: primary ? "none" : "1px solid var(--glass-border-strong)",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <input
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(editVal); }}
              placeholder="свой перевод"
              autoFocus
              style={{ minWidth: 180, padding: "10px 14px", borderRadius: 999, border: "1px solid var(--glass-border-strong)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, fontWeight: 600, outline: "none" }}
            />
            <button className="wbtn" style={{ minHeight: 42, padding: "0 18px", fontSize: 14 }} onClick={() => saveEdit(editVal)} disabled={!editVal.trim()}>
              Сохранить
            </button>
            <button className="gbtn" style={{ minHeight: 42, padding: "0 16px", fontSize: 14 }} onClick={() => setEditing(false)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Верхний ряд */}
      <div style={{ alignSelf: "end" }}>{topRow}</div>

      {/* Средний ряд — главное слово (вопрос или перевод), фиксированный центр */}
      <div
        style={{
          alignSelf: "center",
          fontSize: embedded ? "clamp(30px, 5.2vw, 68px)" : "clamp(34px, 6.5vw, 92px)",
          fontWeight: 800,
          color: "#fff",
          lineHeight: 0.98,
          letterSpacing: "-0.02em",
          textWrap: "balance",
          maxWidth: flipped ? "18ch" : "15ch",
        }}
      >
        {flipped ? answer : question}
      </div>

      {/* Нижний ряд — примеры и действия/оценка */}
      <div
        style={{
          alignSelf: "start",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(12px, 2vh, 20px)",
        }}
      >
        {!flipped ? (
          <>
            {exampleQ && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "flex-start",
                  gap: 10,
                  maxWidth: 560,
                  background: "rgba(255,255,255,0.13)",
                  backdropFilter: "blur(10px)",
                  border: "none",
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

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="gbtn study-cta" onClick={doHint} disabled={hintDone}>
                Подсказка<span className="kbd-arrow"> ↑</span>
              </button>
              <button className="wbtn study-cta" onClick={open}>
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
            {exampleA && (
              <div
                style={{
                  maxWidth: 560,
                  textAlign: "center",
                  color: "rgba(255,255,255,0.9)",
                  fontStyle: "italic",
                  fontSize: "clamp(13px, 1.4vw, 16px)",
                  lineHeight: 1.4,
                }}
              >
                {exampleA}
              </div>
            )}
            {card.alternativeTranslations.length > 0 && card.reviewCount < 2 ? (
              // Первые 2 показа: выбор основного перевода — тап по варианту.
              <div className="study-chooser" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, maxWidth: 560 }}>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600 }}>
                  Выберите основной перевод
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {Array.from(new Set([card.russian, ...card.alternativeTranslations])).map((t) => {
                    const primary = t === card.russian;
                    return (
                      <button
                        key={t}
                        onClick={() => chooseTranslation(t)}
                        className="gpill"
                        style={{
                          cursor: "pointer",
                          padding: "8px 16px",
                          fontSize: 14,
                          fontWeight: 700,
                          color: primary ? "var(--deep)" : "#fff",
                          background: primary ? "#fff" : "var(--glass)",
                          border: primary ? "none" : "1px solid var(--glass-border-strong)",
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              card.alternativeTranslations.length > 0 && (
                <span className="gpill" style={{ color: "rgba(255,255,255,0.85)", padding: "5px 14px" }}>
                  {card.alternativeTranslations.join(" · ")}
                </span>
              )
            )}
            {/* Кнопки оценки — на мобиле скрыты (оценка свайпом карточки). */}
            <div className="grade-area">
            {usedHint ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <span className="gpill" style={{ fontSize: 13 }}>подсказка использована — засчитывается как «Не вспомнил»</span>
                <button
                  className="wbtn"
                  style={{ minHeight: 46, padding: "0 30px", fontSize: 15, color: "#d6403f" }}
                  onClick={() => grade("again")}
                >
                  Не вспомнил<span className="kbd-arrow"> →</span>
                </button>
              </div>
            ) : (
              <div className="grade-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  className="wbtn grade-btn"
                  style={{ minHeight: 46, padding: "0 26px", fontSize: 15, color: "#d6403f" }}
                  onClick={() => grade("again")}
                >
                  <span className="kbd-arrow">← </span>Не вспомнил
                </button>
                <button className="gbtn grade-btn" style={{ minHeight: 46, padding: "0 26px", fontSize: 16 }} onClick={() => grade("hard")}>
                  <span className="kbd-arrow">↓ </span>С трудом
                </button>
                <button className="wbtn grade-btn" style={{ minHeight: 46, padding: "0 30px", fontSize: 16 }} onClick={() => grade("easy")}>
                  Легко<span className="kbd-arrow"> →</span>
                </button>
              </div>
            )}
            </div>
            <div className="swipe-hint">смахни: ← не вспомнил · ↑ легко · с трудом →</div>
          </>
        )}
      </div>
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
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 12px" }}>
          Прогресс фразы {Math.round(card.progress)}%. Повторений: {card.reviewCount}
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
      <div style={{ fontSize: "clamp(34px, 6.5vw, 88px)", fontWeight: 800, color: "#fff", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
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
          style={{ minHeight: 46, padding: "0 28px", fontSize: 16 }}
          onClick={goHome}
        >
          На главную
        </button>
        {emptyFromStart && (upcomingCount ?? 0) === 0 && (
          <button
            className="gbtn"
            style={{ minHeight: 46, padding: "0 24px", fontSize: 16 }}
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
        className={`study-embed ${fbClass}`}
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: "clamp(14px, 2.5vh, 24px)", position: "relative" }}
      >
        {card && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="gpill" style={{ minHeight: 30, padding: "0 12px", fontSize: 10, color: "#fff" }}>
              {card.lessonTitle || title}
            </span>
            <span style={{ flex: 1 }} />
            <button aria-label="Перемешать" title="Перемешать карточки" className="icon-btn icon-btn-sm" onClick={reshuffle}>
              <ShuffleIcon />
            </button>
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
            <button aria-label="Перемешать" title="Перемешать карточки" className="icon-btn" style={{ width: 46, height: 46 }} onClick={reshuffle}>
              <ShuffleIcon />
            </button>
          )}
          {card && (
            <button aria-label="Озвучить" className="icon-btn" style={{ width: 46, height: 46 }} onClick={speakVisible}>
              <SpeakerIcon />
            </button>
          )}
          {card && <Star active={card.favorite} onClick={toggleStar} onPanel />}
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
