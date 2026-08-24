"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "@/lib/api";
import type { Lesson, PhraseCard, Topic } from "@/lib/types";
import { useApp } from "../app-context";
import { EmptyState, Spinner } from "../ui";
import { speakAndWait, prefetchText, stopAudio } from "@/lib/tts-client";

// Прерываемая пауза.
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

const PAUSE_PRESETS = [1.5, 3, 4.5, 6];
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
  const [pauseSec, setPauseSec] = useState(3);
  const [loop, setLoop] = useState(false);
  const [building, setBuilding] = useState(false);

  // Плеер (queue !== null → режим воспроизведения).
  const [queue, setQueue] = useState<PhraseCard[] | null>(null);
  const [pos, setPos] = useState(0);
  const [step, setStep] = useState<"ru" | "en" | "pause" | "done">("ru");
  const [playing, setPlaying] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const loopRef = useRef(loop);
  const pauseRef = useRef(pauseSec);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { pauseRef.current = pauseSec; }, [pauseSec]);

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
        if (typeof s.loop === "boolean") setLoop(s.loop);
      }
    } catch {}
  }, []);

  useEffect(() => {
    A.lessons(false).then(setLessons).catch(() => setLessons([]));
    A.topics().then(setTopics).catch(() => {});
    return () => { abortRef.current?.abort(); stopAudio(); };
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
      localStorage.setItem(LS_KEY, JSON.stringify({ checked: [...checked], excluded: [...excluded], pauseSec, loop }));
    } catch {}
  }, [checked, excluded, pauseSec, loop]);

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
    return out;
  };

  const run = useCallback(
    async (q: PhraseCard[], startPos: number) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const signal = ac.signal;
      setPlaying(true);
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
        for (let k = 0; k < 3; k++) {
          setStep("en");
          await speakAndWait(card.english, voice, settings.speechRate, signal);
          if (signal.aborted) return;
          setStep("pause");
          await sleep(pauseRef.current * 1000, signal);
          if (signal.aborted) return;
        }
      }
      if (signal.aborted) return;
      if (loopRef.current && q.length) {
        run(q, 0);
        return;
      }
      setPlaying(false);
      setStep("done");
    },
    [voice, settings.speechRate]
  );

  const start = async () => {
    setBuilding(true);
    const q = await buildQueue();
    setBuilding(false);
    if (!q.length) return;
    setQueue(q);
    setPos(0);
    run(q, 0);
  };

  const pausePlayback = () => { abortRef.current?.abort(); stopAudio(); setPlaying(false); };
  const resume = () => { if (queue) run(queue, pos); };
  const goNext = () => { if (queue) run(queue, Math.min(pos + 1, queue.length - 1)); };
  const goPrev = () => { if (queue) run(queue, Math.max(pos - 1, 0)); };
  const backToSelection = () => { abortRef.current?.abort(); stopAudio(); setQueue(null); setPlaying(false); };

  /* ── Плеер ──────────────────────────────────────────────────────────── */
  if (queue) {
    const card = queue[pos];
    const done = step === "done";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button className="gbtn gbtn-sm" onClick={backToSelection}>← к выбору</button>
          <span className="gpill" style={{ minHeight: 34, fontSize: 13 }}>
            {Math.min(pos + 1, queue.length)} / {queue.length}
          </span>
        </div>

        <div
          className="wcard"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "40px 20px", textAlign: "center", minHeight: 320, justifyContent: "center" }}
        >
          {done ? (
            <div style={{ fontSize: "clamp(30px, 6vw, 56px)", fontWeight: 800, color: "#fff" }}>
              готово<span className="dim">.</span>
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: "clamp(28px, 5vw, 52px)",
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
                  fontSize: "clamp(26px, 4.5vw, 46px)",
                  fontWeight: 800,
                  color: "#fff",
                  lineHeight: 1.02,
                  opacity: step === "en" ? 1 : 0.55,
                  transition: "opacity 0.2s",
                }}
              >
                {card.english}
              </div>
              <span className="gpill" style={{ marginTop: 6, fontSize: 12 }}>
                {step === "ru" ? "🔊 русский" : step === "en" ? "🔊 english" : "⏸ пауза"}
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
            <button className="wbtn wbtn-lg" style={{ minWidth: 120 }} onClick={done ? () => run(queue, 0) : resume}>
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

      {/* Настройки воспроизведения */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Пауза:</span>
          {PAUSE_PRESETS.map((s) => (
            <button
              key={s}
              className={pauseSec === s ? "wbtn wbtn-sm" : "gbtn gbtn-sm"}
              style={{ minHeight: 36, padding: "0 14px" }}
              onClick={() => setPauseSec(s)}
            >
              {String(s).replace(".", ",")}с
            </button>
          ))}
        </div>
        <button
          className={loop ? "wbtn wbtn-sm" : "gbtn gbtn-sm"}
          style={{ minHeight: 36 }}
          onClick={() => setLoop((v) => !v)}
        >
          ↻ повтор {loop ? "вкл" : "выкл"}
        </button>
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
