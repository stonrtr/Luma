"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { speak } from "@/lib/speech";
import { shuffle, sample, isCorrect } from "@/lib/util";
import StudyHeader from "@/components/StudyHeader";
import { IcSound, IcCheck } from "@/components/icons";
import type { LearnProgress, Term } from "@/lib/types";

type QType = "mc" | "written";
interface Question {
  term: Term;
  type: QType;
  choices?: Term[];
}

const ROUND_SIZE = 7;

export default function Learn() {
  const { setId } = useParams<{ setId: string }>();
  const { getSet, ready, data, statsFor, saveLearn, touchRecent, resetProgress } =
    useStore();
  const set = getSet(setId);

  const [progress, setProgress] = useState<LearnProgress>({});
  const [queue, setQueue] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [answered, setAnswered] = useState<null | {
    correct: boolean;
    picked?: string;
  }>(null);
  const [written, setWritten] = useState("");
  const [roundDone, setRoundDone] = useState(false);
  const inited = useRef(false);

  // init
  useEffect(() => {
    if (!set || inited.current) return;
    inited.current = true;
    touchRecent(set.id);
    const existing = statsFor(set.id).learn;
    const prog: LearnProgress = {};
    set.terms.forEach((t) => {
      prog[t.id] = existing[t.id] ?? { box: 0, seen: 0, correct: 0, lastRound: 0 };
    });
    setProgress(prog);
    setQueue(buildRound(set.terms, prog, 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id]);

  const q = queue[idx];

  const mastered = useMemo(
    () => Object.values(progress).filter((p) => p.box >= 2).length,
    [progress]
  );
  const familiar = useMemo(
    () => Object.values(progress).filter((p) => p.box === 1).length,
    [progress]
  );
  const total = set?.terms.length ?? 0;

  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;
  if (!set) return <div className="p-10 text-center">Set not found.</div>;
  if (set.terms.length < 4)
    return (
      <div className="p-16 text-center text-muted-c">
        Add at least 4 terms to use Learn mode.
      </div>
    );

  const submit = (correct: boolean, picked?: string) => {
    if (answered) return;
    setAnswered({ correct, picked });
    if (q) {
      speak(
        correct ? q.term.definition : q.term.term,
        correct ? set.defLang : set.termLang,
        data.settings.soundOn
      );
      const p = { ...progress };
      const cur = p[q.term.id];
      cur.seen += 1;
      if (correct) {
        cur.correct += 1;
        cur.box = Math.min(2, cur.box + 1);
      } else {
        cur.box = 0;
      }
      cur.lastRound = round;
      setProgress(p);
    }
  };

  const advance = () => {
    setAnswered(null);
    setWritten("");
    if (idx + 1 < queue.length) {
      setIdx(idx + 1);
    } else {
      // round finished
      saveLearn(set.id, progress, round);
      const remaining = set.terms.filter((t) => progress[t.id].box < 2);
      if (remaining.length === 0) {
        setRoundDone(true);
      } else {
        setRoundDone(true);
      }
    }
  };

  const nextRound = () => {
    const nr = round + 1;
    setRound(nr);
    setQueue(buildRound(set.terms, progress, nr));
    setIdx(0);
    setRoundDone(false);
    setAnswered(null);
    setWritten("");
  };

  const overallPct = total ? Math.round((mastered / total) * 100) : 0;

  if (roundDone) {
    const allDone = mastered === total;
    return (
      <div>
        <StudyHeader setId={set.id} title={`Learn · ${set.title}`} />
        <div className="mx-auto max-w-[620px] px-4 py-10 text-center pop-in">
          <div className="text-5xl">{allDone ? "🏆" : "⭐"}</div>
          <h1 className="mt-3 text-2xl font-black text-heading-c">
            {allDone ? "You've mastered the set!" : `Round ${round} complete`}
          </h1>
          <div className="surface mt-6 rounded-2xl border border-line-c p-6">
            <Bar label="Mastered" value={mastered} total={total} color="var(--color-correct)" />
            <Bar
              label="Familiar"
              value={familiar}
              total={total}
              color="var(--color-assembly)"
            />
            <Bar
              label="Still learning"
              value={total - mastered - familiar}
              total={total}
              color="var(--color-incorrect)"
            />
          </div>
          {allDone ? (
            <button
              className="qbtn qbtn-ghost mt-6"
              onClick={() => {
                resetProgress(set.id);
                inited.current = false;
                setRound(1);
                location.reload();
              }}
            >
              Restart Learn
            </button>
          ) : (
            <button className="qbtn qbtn-primary mt-6" onClick={nextRound}>
              Continue to round {round + 1}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!q) return <div className="p-10 text-center text-muted-c">Loading round…</div>;

  return (
    <div>
      <StudyHeader
        setId={set.id}
        title={`Learn · ${set.title}`}
        right={
          <span className="text-sm font-bold text-muted-c">{overallPct}% mastered</span>
        }
      />
      {/* round progress */}
      <div className="mx-auto max-w-[720px] px-4 pt-4">
        <div className="h-1.5 w-full rounded bg-line-c overflow-hidden">
          <div
            className="h-full bg-assembly transition-all"
            style={{ width: `${((idx + (answered ? 1 : 0)) / queue.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mx-auto max-w-[720px] px-4 py-6">
        <div className="mb-2 text-sm font-bold text-muted-c">
          {q.type === "mc" ? "Choose the correct answer" : "Type the answer"}
        </div>
        <div className="surface rounded-2xl border border-line-c p-6 md:p-8" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-start justify-between">
            <div className="text-xs font-bold tracking-wide text-muted-c">DEFINITION</div>
            <button
              className="text-muted-c hover:text-assembly"
              onClick={() => speak(q.term.definition, set.defLang, data.settings.soundOn)}
            >
              <IcSound size={18} />
            </button>
          </div>
          <div className="mt-3 text-2xl font-medium text-heading-c">
            {q.term.definition}
          </div>

          {q.type === "mc" ? (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {q.choices!.map((c) => {
                const isRight = c.id === q.term.id;
                const picked = answered?.picked === c.id;
                let cls =
                  "border-line-c hover:border-assembly text-heading-c";
                if (answered) {
                  if (isRight) cls = "border-correct bg-correct-bg text-heading-c";
                  else if (picked) cls = "border-incorrect bg-incorrect-bg text-heading-c";
                  else cls = "border-line-c opacity-60 text-heading-c";
                }
                return (
                  <button
                    key={c.id}
                    disabled={!!answered}
                    onClick={() => submit(isRight, c.id)}
                    className={"flex items-center gap-3 rounded-xl border-2 p-4 text-left font-medium transition-colors " + cls}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-xs">
                      {answered && isRight ? "✓" : ""}
                    </span>
                    {c.term}
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (answered) advance();
                else submit(isCorrect(written, q.term.term));
              }}
            >
              <input
                autoFocus
                value={written}
                onChange={(e) => setWritten(e.target.value)}
                disabled={!!answered}
                placeholder="Type the answer"
                className={
                  "w-full rounded-xl border-2 bg-transparent p-4 text-lg text-heading-c outline-none " +
                  (answered
                    ? answered.correct
                      ? "border-correct bg-correct-bg"
                      : "border-incorrect bg-incorrect-bg"
                    : "border-line-c focus:border-assembly")
                }
              />
              {answered && !answered.correct && (
                <div className="mt-3 text-sm">
                  <span className="text-muted-c">Correct answer: </span>
                  <span className="font-bold text-correct">{q.term.term}</span>
                </div>
              )}
              {!answered && (
                <div className="mt-3 flex justify-between">
                  <button
                    type="button"
                    onClick={() => submit(false)}
                    className="text-sm font-bold text-muted-c hover:text-heading-c"
                  >
                    Don&apos;t know?
                  </button>
                  <button type="submit" className="qbtn qbtn-primary">
                    Answer
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        {answered && (
          <div className="mt-5 flex items-center justify-between pop-in">
            <div
              className={
                "flex items-center gap-2 font-bold " +
                (answered.correct ? "text-correct" : "text-incorrect")
              }
            >
              {answered.correct ? (
                <>
                  <IcCheck size={20} /> Nice!
                </>
              ) : (
                "Keep practicing this one"
              )}
            </div>
            <button className="qbtn qbtn-primary" onClick={advance} autoFocus>
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Build a round: prioritize lowest-box terms; MC for new terms, written for familiar. */
function buildRound(
  terms: Term[],
  prog: LearnProgress,
  round: number
): Question[] {
  const active = terms.filter((t) => (prog[t.id]?.box ?? 0) < 2);
  const pool = shuffle(
    [...active].sort((a, b) => (prog[a.id]?.box ?? 0) - (prog[b.id]?.box ?? 0))
  ).slice(0, ROUND_SIZE);
  return pool.map((term) => {
    const box = prog[term.id]?.box ?? 0;
    // familiar (box>=1) terms get harder written questions
    const type: QType = box >= 1 || round > 2 ? "written" : "mc";
    if (type === "written") return { term, type };
    const distractors = sample(terms, 3, term);
    return { term, type, choices: shuffle([term, ...distractors]) };
  });
}

function Bar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  return (
    <div className="mb-3 last:mb-0 text-left">
      <div className="mb-1 flex justify-between text-sm font-bold text-body-c">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 w-full rounded bg-line-c overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${total ? (value / total) * 100 : 0}%`, background: color }}
        />
      </div>
    </div>
  );
}
