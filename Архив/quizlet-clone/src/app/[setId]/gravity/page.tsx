"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { shuffle, isCorrect } from "@/lib/util";
import StudyHeader from "@/components/StudyHeader";
import type { Term } from "@/lib/types";

interface Asteroid {
  id: number;
  term: Term;
  x: number; // 0..100 percent
  y: number; // px from top
  speed: number;
}

export default function Gravity() {
  const { setId } = useParams<{ setId: string }>();
  const { getSet, ready, touchRecent, recordScore, statsFor } = useStore();
  const set = getSet(setId);

  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [input, setInput] = useState("");
  const areaRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const spawnAcc = useRef(0);
  const raf = useRef<number>(0);
  const last = useRef<number>(0);
  const state = useRef({ asteroids: [] as Asteroid[], lives: 3, level: 1, score: 0 });

  const start = () => {
    setPhase("play");
    setScore(0);
    setLevel(1);
    setLives(3);
    setAsteroids([]);
    state.current = { asteroids: [], lives: 3, level: 1, score: 0 };
    nextId.current = 0;
    spawnAcc.current = 0;
    last.current = performance.now();
  };

  useEffect(() => {
    if (set) touchRecent(set.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id]);

  const loop = useCallback(
    (now: number) => {
      const dt = Math.min(64, now - last.current);
      last.current = now;
      const height = areaRef.current?.clientHeight ?? 500;
      const s = state.current;
      const speedMul = 1 + (s.level - 1) * 0.18;

      // move
      s.asteroids = s.asteroids.map((a) => ({ ...a, y: a.y + a.speed * speedMul * (dt / 1000) }));

      // check bottom collisions
      const survived: Asteroid[] = [];
      let lostLife = false;
      for (const a of s.asteroids) {
        if (a.y >= height - 60) {
          lostLife = true;
        } else survived.push(a);
      }
      if (lostLife) {
        s.lives -= 1;
        setLives(s.lives);
      }
      s.asteroids = survived;

      // spawn
      spawnAcc.current += dt;
      const spawnEvery = Math.max(1100, 2600 - s.level * 140);
      if (spawnAcc.current > spawnEvery && set) {
        spawnAcc.current = 0;
        const term = shuffle(set.terms)[0];
        s.asteroids.push({
          id: nextId.current++,
          term,
          x: 8 + Math.random() * 78,
          y: -20,
          speed: 55 + Math.random() * 25,
        });
      }

      setAsteroids([...s.asteroids]);

      if (s.lives <= 0) {
        setPhase("over");
        recordScore(setId, "gravityBest", s.score);
        return;
      }
      raf.current = requestAnimationFrame(loop);
    },
    [set, setId, recordScore]
  );

  useEffect(() => {
    if (phase !== "play") return;
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, loop]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = state.current;
    // find lowest asteroid whose definition matches
    const target = [...s.asteroids]
      .sort((a, b) => b.y - a.y)
      .find((a) => isCorrect(input, a.term.definition) || isCorrect(input, a.term.term));
    if (target) {
      s.asteroids = s.asteroids.filter((a) => a.id !== target.id);
      s.score += 100 * s.level;
      setScore(s.score);
      if (s.score > s.level * 500) {
        s.level += 1;
        setLevel(s.level);
      }
      setAsteroids([...s.asteroids]);
    }
    setInput("");
  };

  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;
  if (!set) return <div className="p-10 text-center">Set not found.</div>;

  const best = statsFor(set.id).gravityBest ?? 0;

  return (
    <div>
      <StudyHeader
        setId={set.id}
        title={`Blast · ${set.title}`}
        right={
          phase === "play" ? (
            <div className="flex items-center gap-4 text-sm font-bold">
              <span className="text-assembly">Score {score}</span>
              <span className="text-muted-c">Lvl {level}</span>
              <span>{"❤️".repeat(lives)}</span>
            </div>
          ) : undefined
        }
      />

      {phase === "intro" && (
        <div className="mx-auto max-w-[520px] px-4 py-12 text-center">
          <div className="text-5xl">☄️</div>
          <h1 className="mt-3 text-2xl font-black text-heading-c">Blast</h1>
          <p className="mt-2 text-muted-c">
            Terms fall from the sky. Type the matching definition (or term) and
            hit enter to blast them before they land. Miss 3 and it&apos;s game
            over.
          </p>
          <p className="mt-2 text-sm text-muted-c">High score: {best}</p>
          <button className="qbtn qbtn-primary mt-6" onClick={start}>
            Start
          </button>
        </div>
      )}

      {phase === "over" && (
        <div className="mx-auto max-w-[520px] px-4 py-12 text-center pop-in">
          <div className="text-5xl">💥</div>
          <h1 className="mt-3 text-2xl font-black text-heading-c">Game over</h1>
          <p className="mt-2 text-3xl font-black text-assembly">{score}</p>
          <p className="mt-1 text-muted-c">
            {score >= best ? "🏅 New high score!" : `High score: ${best}`}
          </p>
          <button className="qbtn qbtn-primary mt-6" onClick={start}>
            Play again
          </button>
        </div>
      )}

      {phase === "play" && (
        <div className="mx-auto max-w-[720px] px-4 py-4">
          <div
            ref={areaRef}
            className="relative overflow-hidden rounded-2xl border border-line-c"
            style={{
              height: 460,
              background:
                "radial-gradient(circle at 30% 20%, #1a1c4d, #0a092d 70%)",
            }}
          >
            {asteroids.map((a) => (
              <div
                key={a.id}
                className="absolute -translate-x-1/2 rounded-xl px-3 py-2 text-center text-sm font-bold text-white shadow-lg"
                style={{
                  left: `${a.x}%`,
                  top: a.y,
                  background: "linear-gradient(180deg,#4255ff,#3b49df)",
                  maxWidth: 200,
                }}
              >
                {a.term.term}
              </div>
            ))}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-incorrect/40 to-transparent" />
          </div>
          <form onSubmit={submit} className="mt-3">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type the definition and press Enter…"
              className="w-full rounded-xl border-2 border-line-c bg-transparent p-3 text-heading-c outline-none focus:border-assembly"
            />
          </form>
        </div>
      )}
    </div>
  );
}
