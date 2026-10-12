"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { A } from "@/lib/api";
import type { PhraseCard } from "@/lib/types";
import type { StudyScope } from "../app-context";
import { playSfx, primeSfx } from "@/lib/sfx";
import { Spinner, EmptyState } from "../ui";

// Игра «Подбор» (как в Quizlet): сетка перемешанных плиток — английское слово и
// его перевод. Тапаешь пару; совпала — исчезает, нет — подсветка ошибки. Экран за
// экраном проходим все фразы урока на время.

const BATCH = 6; // пар на экран (до 12 плиток)
const WRONG_MS = 650; // сколько держим красную подсветку промаха

type Side = "en" | "ru";
type Tile = { key: string; cardId: string; text: string; side: Side };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTiles(cards: PhraseCard[]): Tile[] {
  const tiles: Tile[] = [];
  for (const c of cards) {
    tiles.push({ key: `${c.id}:en`, cardId: c.id, text: c.english, side: "en" });
    tiles.push({ key: `${c.id}:ru`, cardId: c.id, text: c.russian, side: "ru" });
  }
  return shuffle(tiles);
}

export function MatchGame({ scope, onClose }: { scope: StudyScope; onClose: () => void }) {
  const [cards, setCards] = useState<PhraseCard[] | null>(null);
  const [title, setTitle] = useState(scope.title || "");
  const [order, setOrder] = useState<PhraseCard[]>([]); // перемешанный порядок фраз
  const [batchStart, setBatchStart] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0); // мс
  const lockRef = useRef(false); // блокируем ввод на время красной подсветки

  // Загрузка всех фраз урока.
  useEffect(() => {
    if (!scope.lessonId) {
      setCards([]);
      return;
    }
    A.lesson(scope.lessonId)
      .then((r) => {
        setTitle((t) => t || r.lesson.title);
        const usable = r.phrases.filter((p) => p.english?.trim() && p.russian?.trim());
        setCards(usable);
      })
      .catch(() => setCards([]));
  }, [scope.lessonId]);

  // Старт/рестарт: перемешать порядок фраз и собрать первый экран.
  const startGame = useCallback((all: PhraseCard[]) => {
    const ord = shuffle(all);
    setOrder(ord);
    setBatchStart(0);
    setTiles(buildTiles(ord.slice(0, BATCH)));
    setSelected(null);
    setMatched(new Set());
    setWrong(new Set());
    setFinished(false);
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (cards && cards.length) startGame(cards);
  }, [cards, startGame]);

  // Таймер — идёт, пока игра активна.
  useEffect(() => {
    if (finished || !tiles.length) return;
    const t0 = Date.now() - elapsed;
    const id = setInterval(() => setElapsed(Date.now() - t0), 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, tiles.length === 0]);

  // Когда экран собран полностью — следующий экран или финиш.
  useEffect(() => {
    if (!tiles.length || matched.size < tiles.length) return;
    const nextStart = batchStart + BATCH;
    const t = setTimeout(() => {
      if (nextStart >= order.length) {
        setFinished(true);
      } else {
        setBatchStart(nextStart);
        setTiles(buildTiles(order.slice(nextStart, nextStart + BATCH)));
        setSelected(null);
        setMatched(new Set());
        setWrong(new Set());
      }
    }, 280);
    return () => clearTimeout(t);
  }, [matched, tiles, batchStart, order]);

  const onTile = (tile: Tile) => {
    if (lockRef.current || matched.has(tile.key) || finished) return;
    primeSfx();
    if (selected === null) {
      setSelected(tile.key);
      return;
    }
    if (selected === tile.key) {
      setSelected(null);
      return;
    }
    const first = tiles.find((t) => t.key === selected);
    if (!first) {
      setSelected(tile.key);
      return;
    }
    const isMatch = first.cardId === tile.cardId && first.side !== tile.side;
    if (isMatch) {
      playSfx("success");
      setMatched((m) => new Set(m).add(first.key).add(tile.key));
      setSelected(null);
    } else {
      playSfx("mistake");
      const pair = new Set<string>([first.key, tile.key]);
      setWrong(pair);
      lockRef.current = true;
      setTimeout(() => {
        setWrong(new Set());
        setSelected(null);
        lockRef.current = false;
      }, WRONG_MS);
    }
  };

  const timeStr = (elapsed / 1000).toFixed(1).replace(".", ",");
  const totalScreens = Math.max(1, Math.ceil(order.length / BATCH));
  const curScreen = Math.min(totalScreens, Math.floor(batchStart / BATCH) + 1);

  return (
    <div
      className="app-outer"
      style={{ position: "fixed", inset: 0, zIndex: 50, overflowY: "auto", gap: "clamp(16px, 3vh, 26px)" }}
    >
      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="gbtn" onClick={onClose}>✕ выйти</button>
          <span className="gpill" style={{ minHeight: 46, padding: "0 20px", fontSize: 14 }}>
            Подбор · {title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <div className="brand" style={{ fontSize: "clamp(22px, 3vw, 30px)" }}>
            luma<span className="dim">.</span>
          </div>
          <div className="brand-sub" style={{ letterSpacing: "0.18em" }}>Match</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!finished && order.length > 0 && (
            <span className="gpill" style={{ minHeight: 46, padding: "0 18px", fontSize: 14 }}>
              экран {curScreen} / {totalScreens}
            </span>
          )}
          <span className="wbtn" style={{ cursor: "default", fontSize: 15, minWidth: 92, justifyContent: "center" }}>
            {timeStr} с
          </span>
        </div>
      </div>

      {/* Тело */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {cards === null ? (
          <div style={{ display: "grid", placeItems: "center", padding: 40 }}><Spinner size={26} /></div>
        ) : cards.length === 0 ? (
          <EmptyState icon="🧩" title="Нечего подбирать" hint="В уроке нет фраз с переводом." />
        ) : finished ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center", padding: "20px" }}>
            <div style={{ fontSize: 52 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: 26 }}>Готово!</div>
            <div className="muted" style={{ fontSize: 16 }}>
              {order.length} фраз · время {timeStr} с
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button className="abtn" onClick={() => cards && startGame(cards)}>Заново</button>
              <button className="gbtn" onClick={onClose}>Выйти</button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "clamp(10px, 1.6vw, 16px)",
            }}
          >
            {tiles.map((tile) => {
              const isMatched = matched.has(tile.key);
              const isSel = selected === tile.key;
              const isWrong = wrong.has(tile.key);
              return (
                <button
                  key={tile.key}
                  onClick={() => onTile(tile)}
                  className="wcard"
                  aria-hidden={isMatched}
                  tabIndex={isMatched ? -1 : 0}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    minHeight: "clamp(92px, 16vh, 148px)",
                    padding: "14px 16px",
                    fontWeight: 700,
                    fontSize: "clamp(14px, 1.5vw, 18px)",
                    color: "var(--ink)",
                    cursor: isMatched ? "default" : "pointer",
                    lineHeight: 1.25,
                    transition: "opacity .22s ease, box-shadow .12s ease, transform .12s ease",
                    opacity: isMatched ? 0 : 1,
                    pointerEvents: isMatched ? "none" : "auto",
                    transform: isSel ? "translateY(-2px)" : "none",
                    boxShadow: isWrong
                      ? "0 0 0 3px var(--danger)"
                      : isSel
                        ? "0 0 0 3px var(--accent)"
                        : undefined,
                  }}
                >
                  {tile.text}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
