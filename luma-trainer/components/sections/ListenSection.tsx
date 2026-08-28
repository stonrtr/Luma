"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "@/lib/api";
import type { Lesson, PhraseCard, Topic } from "@/lib/types";
import { useApp } from "../app-context";
import { EmptyState, Spinner } from "../ui";
import { speakAndWait, prefetchText, stopAudio, primeListenAudio } from "@/lib/tts-client";

// Прерываемая пауза.
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

// Перемешать (Fisher–Yates) — новый массив, исходный не трогаем.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PAUSE_PRESETS = [1, 1.5, 2, 2.5, 3];
const REPEAT_PRESETS = [1, 2, 3];
const LS_KEY = "luma:listen";

/**
 * Раздел «Слушать» — аудирование на слух. Выбираешь уроки (по умолчанию все
 * карточки; можно исключить отдельные), запускаешь — и подряд для каждой карточки:
 * русская фраза → пауза → английский перевод ×3 (с паузами) → следующая карточка.
 */
export function ListenSection() {
  const { settings, ttsAvailable } = useApp();
  const voice = settings.voice;

  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cardsByLesson, setCardsByLesson] = useState<Record<string, PhraseCard[]>>({});
  const [pauseSec, setPauseSec] = useState(2);
  const [repeats, setRepeats] = useState(3);
  const [withExample, setWithExample] = useState(false);
  const [loop, setLoop] = useState(false);
  const [building, setBuilding] = useState(false);

  // Плеер (queue !== null → режим воспроизведения).
  const [queue, setQueue] = useState<PhraseCard[] | null>(null);
  const [pos, setPos] = useState(0);
  const [step, setStep] = useState<"ru" | "en" | "ru-ex" | "en-ex" | "pause" | "done">("ru");
  const [playing, setPlaying] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // Wake Lock: держим экран включённым, пока идёт воспроизведение — иначе iOS
  // блокирует экран, усыпляет страницу и Web Audio останавливается.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const acquireWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null; });
      }
    } catch {
      /* нет поддержки / отказ — не критично */
    }
  }, []);
  const releaseWakeLock = useCallback(() => {
    try {
      void wakeLockRef.current?.release();
    } catch {}
    wakeLockRef.current = null;
  }, []);
  const loopRef = useRef(loop);
  const pauseRef = useRef(pauseSec);
  const repeatsRef = useRef(repeats);
  const exampleRef = useRef(withExample);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { pauseRef.current = pauseSec; }, [pauseSec]);
  useEffect(() => { repeatsRef.current = repeats; }, [repeats]);
  useEffect(() => { exampleRef.current = withExample; }, [withExample]);

  // Восстановление сохранённого выбора (объявлено ДО сохраняющего эффекта,
  // чтобы прочитать localStorage раньше, чем он перезапишется).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.checked)) setChecked(new Set(s.checked));
        if (Array.isArray(s.excluded)) setExcluded(new Set(s.excluded));
        if (typeof s.pauseSec === "number") setPauseSec(s.pauseSec);
        if (typeof s.repeats === "number") setRepeats(s.repeats);
        if (typeof s.withExample === "boolean") setWithExample(s.withExample);
        if (typeof s.loop === "boolean") setLoop(s.loop);
      }
    } catch {}
  }, []);

  useEffect(() => {
    A.lessons(false).then(setLessons).catch(() => setLessons([]));
    A.topics().then(setTopics).catch(() => {});
    // При возврате на вкладку заново берём Wake Lock, если ещё играем
    // (система снимает его, когда страница уходит в фон).
    const onVisible = () => {
      if (document.visibilityState === "visible" && abortRef.current && !abortRef.current.signal.aborted) {
        void acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      abortRef.current?.abort();
      stopAudio();
      releaseWakeLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Сохраняем выбор — чтобы вернуться и сразу нажать «Слушать».
  // Пропускаем первое (монтирующее) срабатывание: иначе оно перезаписало бы
  // сохранённое пустым значением ДО того, как применится восстановление выше.
  const firstSave = useRef(true);
  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ checked: [...checked], excluded: [...excluded], pauseSec, repeats, withExample, loop }));
    } catch {}
  }, [checked, excluded, pauseSec, repeats, withExample, loop]);

  // Подгружаем карточки выбранных уроков (для счётчика и построения очереди).
  useEffect(() => {
    if (!lessons) return;
    for (const id of checked) if (!cardsByLesson[id]) void loadCards(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons]);

  const grouped = lessons
    ? [
        ...topics
          .map((t) => ({ name: t.name, items: lessons.filter((l) => l.topicId === t.id) }))
          .filter((g) => g.items.length),
        { name: "Без темы", items: lessons.filter((l) => !l.topicId) },
      ].filter((g) => g.items.length)
    : [];

  const loadCards = useCallback(
    async (lessonId: string): Promise<PhraseCard[]> => {
      const existing = cardsByLesson[lessonId];
      if (existing) return existing;
      const r = await A.lesson(lessonId).catch(() => null);
      const cards = (r?.phrases || []).filter((p) => p.translationStatus === "ready" && p.english && p.russian);
      setCardsByLesson((m) => ({ ...m, [lessonId]: cards }));
      return cards;
    },
    [cardsByLesson]
  );

  const toggleLesson = (id: string) => {
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    if (!cardsByLesson[id]) void loadCards(id);
  };

  const toggleExpand = (id: string) => {
    setExpanded((e) => (e === id ? null : id));
    if (!cardsByLesson[id]) void loadCards(id);
  };

  const toggleCard = (cardId: string) =>
    setExcluded((s) => {
      const n = new Set(s);
      if (n.has(cardId)) n.delete(cardId);
      else n.add(cardId);
      return n;
    });

  // Сколько карточек выбрано (по загруженным урокам).
  const selectedCount = (() => {
    let n = 0;
    for (const id of checked) {
      const cards = cardsByLesson[id];
      if (cards) n += cards.filter((c) => !excluded.has(c.id)).length;
    }
    return n;
  })();

  const buildQueue = async (): Promise<PhraseCard[]> => {
    const out: PhraseCard[] = [];
    for (const id of checked) {
      const cards = await loadCards(id);
      for (const c of cards) if (!excluded.has(c.id)) out.push(c);
    }
    return shuffle(out); // всегда перемешиваем
  };

  const run = useCallback(
    async (q: PhraseCard[], startPos: number) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const signal = ac.signal;
      setPlaying(true);
      void acquireWakeLock();
      for (let i = startPos; i < q.length; i++) {
        if (signal.aborted) return;
        setPos(i);
        const card = q[i];
        const next = q[i + 1];
        if (next) {
          void prefetchText(next.russian, voice);
          void prefetchText(next.english, voice);
        }
        setStep("ru");
        await speakAndWait(card.russian, voice, settings.speechRate, signal);
        if (signal.aborted) return;
        setStep("pause");
        await sleep(pauseRef.current * 1000, signal);
        if (signal.aborted) return;
        for (let k = 0; k < repeatsRef.current; k++) {
          setStep("en");
          await speakAndWait(card.english, voice, settings.speechRate, signal);
          if (signal.aborted) return;
          setStep("pause");
          await sleep(pauseRef.current * 1000, signal);
          if (signal.aborted) return;
        }
        // Пример предложения (опционально): русский → пауза → английский.
        if (exampleRef.current && card.exampleRu && card.exampleEn) {
          setStep("ru-ex");
          await speakAndWait(card.exampleRu, voice, settings.speechRate, signal);
          if (signal.aborted) return;
          setStep("pause");
          await sleep(pauseRef.current * 1000, signal);
          if (signal.aborted) return;
          setStep("en-ex");
          await speakAndWait(card.exampleEn, voice, settings.speechRate, signal);
          if (signal.aborted) return;
          setStep("pause");
          await sleep(pauseRef.current * 1000, signal);
          if (signal.aborted) return;
        }
      }
      if (signal.aborted) return;
      if (loopRef.current && q.length) {
        const nq = shuffle(q); // каждый круг — новый порядок
        setQueue(nq);
        run(nq, 0);
        return;
      }
      setPlaying(false);
      setStep("done");
      releaseWakeLock();
    },
    [voice, settings.speechRate, acquireWakeLock, releaseWakeLock]
  );

  const start = async () => {
    primeListenAudio(); // разблокировать аудио в рамках жеста, ДО await
    setBuilding(true);
    const q = await buildQueue();
    setBuilding(false);
    if (!q.length) return;
    setQueue(q);
    setPos(0);
    run(q, 0);
  };

  const pausePlayback = () => { abortRef.current?.abort(); stopAudio(); setPlaying(false); releaseWakeLock(); };
  const resume = () => { if (queue) { primeListenAudio(); run(queue, pos); } };
  const goNext = () => { if (queue) { primeListenAudio(); run(queue, Math.min(pos + 1, queue.length - 1)); } };
  const goPrev = () => { if (queue) { primeListenAudio(); run(queue, Math.max(pos - 1, 0)); } };
  const backToSelection = () => { abortRef.current?.abort(); stopAudio(); setQueue(null); setPlaying(false); releaseWakeLock(); };
  const reshuffle = () => {
    if (!queue) return;
    primeListenAudio();
    const q = shuffle(queue);
    setQueue(q);
    setPos(0);
    run(q, 0);
  };

  /* ── Плеер ──────────────────────────────────────────────────────────── */
  if (queue) {
    const card = queue[pos];
    const done = step === "done";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button className="gbtn gbtn-sm" onClick={backToSelection}>← к выбору</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="gbtn gbtn-sm" onClick={reshuffle} title="Перемешать заново">🔀 перемешать</button>
            <span className="gpill" style={{ minHeight: 34, fontSize: 13 }}>
              {Math.min(pos + 1, queue.length)} / {queue.length}
            </span>
          </div>
        </div>

        <div
          className="wcard"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "40px 20px", textAlign: "center", minHeight: 320, justifyContent: "center" }}
        >
          {done ? (
            <div style={{ fontSize: "clamp(26px, 5vw, 44px)", fontWeight: 800, color: "#fff" }}>
              готово<span className="dim">.</span>
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: "clamp(24px, 4vw, 40px)",
                  fontWeight: 800,
                  color: "#fff",
                  lineHeight: 1.02,
                  opacity: step === "ru" ? 1 : 0.55,
                  transition: "opacity 0.2s",
                }}
              >
                {card.russian}
              </div>
              <div style={{ height: 1, width: 60, background: "rgba(255,255,255,0.2)" }} />
              <div
                style={{
                  fontSize: "clamp(22px, 3.6vw, 36px)",
                  fontWeight: 800,
                  color: "#fff",
                  lineHeight: 1.02,
                  opacity: step === "en" ? 1 : 0.55,
                  transition: "opacity 0.2s",
                }}
              >
                {card.english}
              </div>
              {withExample && card.exampleRu && card.exampleEn && (
                <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4, maxWidth: 520 }}>
                  <div style={{ fontStyle: "italic", fontSize: "clamp(13px, 1.5vw, 16px)", color: "#fff", opacity: step === "ru-ex" ? 1 : 0.4, transition: "opacity 0.2s" }}>
                    {card.exampleRu}
                  </div>
                  <div style={{ fontStyle: "italic", fontSize: "clamp(13px, 1.5vw, 16px)", color: "#fff", opacity: step === "en-ex" ? 1 : 0.4, transition: "opacity 0.2s" }}>
                    {card.exampleEn}
                  </div>
                </div>
              )}
              <span className="gpill" style={{ marginTop: 6, fontSize: 12 }}>
                {step === "ru"
                  ? "🔊 русский"
                  : step === "en"
                    ? "🔊 english"
                    : step === "ru-ex"
                      ? "🔊 пример (рус)"
                      : step === "en-ex"
                        ? "🔊 пример (eng)"
                        : "⏸ пауза"}
              </span>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <button className="icon-btn" style={{ width: 52, height: 52 }} aria-label="Назад" onClick={goPrev} disabled={pos === 0}>
            ⏮
          </button>
          {playing ? (
            <button className="wbtn wbtn-lg" style={{ minWidth: 120 }} onClick={pausePlayback}>
              ⏸ пауза
            </button>
          ) : (
            <button className="wbtn wbtn-lg" style={{ minWidth: 120 }} onClick={done ? () => { primeListenAudio(); run(queue, 0); } : resume}>
              {done ? "↻ заново" : "▶ продолжить"}
            </button>
          )}
          <button className="icon-btn" style={{ width: 52, height: 52 }} aria-label="Вперёд" onClick={goNext} disabled={pos >= queue.length - 1}>
            ⏭
          </button>
        </div>
      </div>
    );
  }

  /* ── Выбор уроков ───────────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="title-hero">
        слушать<span className="dim">.</span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Выбери уроки — и слушай подряд: русская фраза → пауза → английский ×3. Руки свободны.
      </p>

      {!ttsAvailable && (
        <div className="wcard-sm" style={{ color: "var(--danger-2)", fontSize: 13 }}>
          Серверная озвучка недоступна — будет использован голос браузера (качество ниже).
        </div>
      )}

      {/* Настройки воспроизведения — подпись отдельной строкой, кнопки в один ряд */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Пауза</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PAUSE_PRESETS.map((s) => (
              <button
                key={s}
                className={pauseSec === s ? "wbtn wbtn-sm" : "gbtn gbtn-sm"}
                style={{ minHeight: 34, padding: "0 12px", fontSize: 13 }}
                onClick={() => setPauseSec(s)}
              >
                {String(s).replace(".", ",")}с
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Повторов</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {REPEAT_PRESETS.map((n) => (
              <button
                key={n}
                className={repeats === n ? "wbtn wbtn-sm" : "gbtn gbtn-sm"}
                style={{ minHeight: 34, padding: "0 16px", fontSize: 13 }}
                onClick={() => setRepeats(n)}
              >
                ×{n}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            className={withExample ? "wbtn wbtn-sm" : "gbtn gbtn-sm"}
            style={{ minHeight: 34, fontSize: 13 }}
            onClick={() => setWithExample((v) => !v)}
          >
            + пример {withExample ? "вкл" : "выкл"}
          </button>
          <button
            className={loop ? "wbtn wbtn-sm" : "gbtn gbtn-sm"}
            style={{ minHeight: 34, fontSize: 13 }}
            onClick={() => setLoop((v) => !v)}
          >
            ↻ повтор {loop ? "вкл" : "выкл"}
          </button>
        </div>
      </div>

      {lessons === null ? (
        <div style={{ display: "grid", placeItems: "center", padding: 40 }}><Spinner size={24} /></div>
      ) : lessons.length === 0 ? (
        <EmptyState icon="🎧" title="Нет уроков" hint="Сначала добавь уроки и фразы." />
      ) : (
        grouped.map((g) => (
          <div key={g.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: "rgba(255,255,255,0.65)", fontWeight: 700, fontSize: 14 }}>{g.name}</div>
            {g.items.map((l) => {
              const on = checked.has(l.id);
              const cards = cardsByLesson[l.id];
              const isExpanded = expanded === l.id;
              return (
                <div key={l.id} className="wcard" style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      onClick={() => toggleLesson(l.id)}
                      aria-label="Выбрать урок"
                      style={{
                        width: 24, height: 24, flex: "none", borderRadius: 7, cursor: "pointer",
                        border: on ? "none" : "1.5px solid var(--glass-border-strong)",
                        background: on ? "#fff" : "transparent",
                        color: "var(--deep)", fontWeight: 900, fontSize: 15,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {on ? "✓" : ""}
                    </button>
                    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => toggleLesson(l.id)}>
                      <div style={{ fontWeight: 700, color: "var(--ink)" }}>{l.title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{l.stats.total} фраз</div>
                    </div>
                    <button className="lbtn" onClick={() => toggleExpand(l.id)}>{isExpanded ? "свернуть" : "карточки"}</button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      {!cards ? (
                        <div style={{ display: "grid", placeItems: "center", padding: 12 }}><Spinner /></div>
                      ) : cards.length === 0 ? (
                        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Нет готовых фраз.</p>
                      ) : (
                        cards.map((c) => {
                          const inc = on && !excluded.has(c.id);
                          return (
                            <div
                              key={c.id}
                              onClick={() => toggleCard(c.id)}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 2px", cursor: on ? "pointer" : "default", opacity: on ? 1 : 0.5 }}
                            >
                              <span
                                style={{
                                  width: 18, height: 18, flex: "none", borderRadius: 5,
                                  border: inc ? "none" : "1.5px solid var(--glass-border-strong)",
                                  background: inc ? "#fff" : "transparent",
                                  color: "var(--deep)", fontWeight: 900, fontSize: 12,
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                }}
                              >
                                {inc ? "✓" : ""}
                              </span>
                              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, color: "var(--ink)" }}>
                                {c.english} — <span className="muted">{c.russian}</span>
                              </span>
                            </div>
                          );
                        })
                      )}
                      {!on && cards && cards.length > 0 && (
                        <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>Отметь урок галочкой, чтобы включить его карточки.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* Кнопка запуска */}
      {lessons && lessons.length > 0 && (
        <div style={{ position: "sticky", bottom: 0, display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <button className="wbtn wbtn-lg" onClick={start} disabled={selectedCount === 0 || building}>
            {building ? <Spinner /> : `▶ Слушать (${selectedCount})`}
          </button>
        </div>
      )}
    </div>
  );
}
