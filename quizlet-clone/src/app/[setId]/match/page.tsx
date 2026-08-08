"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { shuffle, formatTime } from "@/lib/util";
import StudyHeader from "@/components/StudyHeader";
import type { Term } from "@/lib/types";

interface Tile {
  key: string;
  termId: string;
  text: string;
  side: "term" | "def";
}

export default function Match() {
  const { setId } = useParams<{ setId: string }>();
  const { getSet, ready, touchRecent, recordMatch, statsFor } = useStore();
  const set = getSet(setId);

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [finalTime, setFinalTime] = useState(0);
  const raf = useRef<number>(0);
  const inited = useRef(false);

  const pairs = useMemo(() => {
    if (!set) return [];
    return shuffle(set.terms).slice(0, Math.min(6, set.terms.length));
  }, [set]);

  const startGame = () => {
    const t: Tile[] = [];
    pairs.forEach((p) => {
      t.push({ key: "t_" + p.id, termId: p.id, text: p.term, side: "term" });
      t.push({ key: "d_" + p.id, termId: p.id, text: p.definition, side: "def" });
    });
    setTiles(shuffle(t));
    setMatched(new Set());
    setSelected(null);
    setFinished(false);
    setStartTs(Date.now());
  };

  useEffect(() => {
    if (set && !inited.current) {
      inited.current = true;
      touchRecent(set.id);
      startGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id]);

  // timer
  useEffect(() => {
    if (startTs === null || finished) return;
    const tick = () => {
      setElapsed(Date.now() - startTs);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [startTs, finished]);

  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;
  if (!set) return <div className="p-10 text-center">Set not found.</div>;
  if (set.terms.length < 2)
    return <div className="p-16 text-center text-muted-c">Add more terms to play Match.</div>;

  const click = (tile: Tile) => {
    if (matched.has(tile.key) || finished) return;
    if (selected === null) {
      setSelected(tile.key);
      return;
    }
    if (selected === tile.key) {
      setSelected(null);
      return;
    }
    const prev = tiles.find((t) => t.key === selected)!;
    if (prev.termId === tile.termId && prev.side !== tile.side) {
      // match!
      const nm = new Set(matched).add(prev.key).add(tile.key);
      setMatched(nm);
      setSelected(null);
      if (nm.size === tiles.length) {
        const total = Date.now() - (startTs ?? Date.now());
        setFinalTime(total);
        setFinished(true);
        recordMatch(set.id, total);
      }
    } else {
      // wrong — flash
      setWrong(tile.key);
      const penaltyPrev = selected;
      setTimeout(() => {
        setWrong(null);
        setSelected(null);
      }, 450);
      // apply 1s time penalty by shifting start
      setStartTs((s) => (s ? s - 1000 : s));
      void penaltyPrev;
    }
  };

  const best = statsFor(set.id).matchBest;

  return (
    <div>
      <StudyHeader
        setId={set.id}
        title={`Match · ${set.title}`}
        right={
          <span className="font-black tabular-nums text-assembly">
            {formatTime(finished ? finalTime : elapsed)}
          </span>
        }
      />

      {finished ? (
        <div className="mx-auto max-w-[520px] px-4 py-12 text-center pop-in">
          <div className="text-5xl">⚡</div>
          <h1 className="mt-3 text-2xl font-black text-heading-c">
            {formatTime(finalTime)} seconds
          </h1>
          <p className="mt-1 text-muted-c">
            {best === finalTime ? "🏅 New high score!" : `Your best: ${formatTime(best ?? finalTime)}s`}
          </p>
          <button className="qbtn qbtn-primary mt-6" onClick={startGame}>
            Play again
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-[900px] px-4 py-6">
          <p className="mb-4 text-center text-sm text-muted-c">
            Tap matching terms and definitions to make them disappear. Wrong
            matches add 1&nbsp;second.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {tiles.map((t) => {
              const isMatched = matched.has(t.key);
              const isSel = selected === t.key;
              const isWrong = wrong === t.key || (isSel && wrong);
              return (
                <button
                  key={t.key}
                  onClick={() => click(t)}
                  className={
                    "grid min-h-[130px] place-items-center rounded-2xl border-2 p-4 text-center text-sm font-medium transition-all " +
                    (isMatched
                      ? "invisible"
                      : isWrong
                      ? "border-incorrect bg-incorrect-bg shake"
                      : isSel
                      ? "border-assembly bg-assembly/10 scale-[1.02]"
                      : "surface border-line-c hover:border-assembly")
                  }
                  style={{ color: "var(--heading)" }}
                >
                  {t.text}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
