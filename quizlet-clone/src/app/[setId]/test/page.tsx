"use client";

import { useParams } from "next/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { shuffle, sample, isCorrect } from "@/lib/util";
import StudyHeader from "@/components/StudyHeader";
import { IcCheck, IcX } from "@/components/icons";
import type { Term } from "@/lib/types";

type Kind = "written" | "mc" | "tf" | "match";
interface WrittenQ { kind: "written"; term: Term }
interface McQ { kind: "mc"; term: Term; choices: Term[] }
interface TfQ { kind: "tf"; term: Term; shownDef: string; isTrue: boolean }
interface MatchQ { kind: "match"; pairs: Term[] }
type Q = WrittenQ | McQ | TfQ | MatchQ;

export default function TestMode() {
  const { setId } = useParams<{ setId: string }>();
  const { getSet, ready, touchRecent, recordScore } = useStore();
  const set = getSet(setId);

  const [config, setConfig] = useState({
    count: 10,
    written: true,
    mc: true,
    tf: true,
    match: true,
    answerWith: "term" as "term" | "def",
  });
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const inited = useRef(false);

  useEffect(() => {
    if (set && !inited.current) {
      inited.current = true;
      touchRecent(set.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id]);

  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;
  if (!set) return <div className="p-10 text-center">Set not found.</div>;

  const maxCount = set.terms.length;

  const build = () => {
    const kinds: Kind[] = [];
    if (config.written) kinds.push("written");
    if (config.mc) kinds.push("mc");
    if (config.tf) kinds.push("tf");
    if (kinds.length === 0) kinds.push("mc");

    const chosen = shuffle(set.terms).slice(0, Math.min(config.count, maxCount));
    const qs: Q[] = chosen.map((term, i) => {
      const kind = kinds[i % kinds.length];
      if (kind === "written") return { kind: "written", term };
      if (kind === "mc")
        return { kind: "mc", term, choices: shuffle([term, ...sample(set.terms, 3, term)]) };
      // tf
      const isTrue = Math.random() > 0.5;
      const other = sample(set.terms, 1, term)[0] ?? term;
      return {
        kind: "tf",
        term,
        shownDef: isTrue ? term.definition : other.definition,
        isTrue,
      };
    });

    // optional matching block
    if (config.match && set.terms.length >= 4) {
      qs.push({ kind: "match", pairs: shuffle(set.terms).slice(0, Math.min(5, set.terms.length)) });
    }
    setQuestions(qs);
    setStarted(true);
    setSubmitted(false);
    setAnswers({});
  };

  if (!started) {
    return (
      <div>
        <StudyHeader setId={set.id} title={`Test · ${set.title}`} />
        <div className="mx-auto max-w-[560px] px-4 py-10">
          <h1 className="text-2xl font-black text-heading-c">Set up your test</h1>
          <div className="surface mt-5 rounded-2xl border border-line-c p-6 space-y-5">
            <div>
              <label className="text-sm font-bold text-body-c">
                Questions ({config.count})
              </label>
              <input
                type="range"
                min={1}
                max={maxCount}
                value={config.count}
                onChange={(e) =>
                  setConfig({ ...config, count: +e.target.value })
                }
                className="w-full accent-[var(--color-assembly)]"
              />
            </div>
            <div>
              <div className="text-sm font-bold text-body-c mb-2">Question types</div>
              <div className="grid grid-cols-2 gap-2">
                <TypeToggle
                  label="Written"
                  on={config.written}
                  set={(v) => setConfig({ ...config, written: v })}
                />
                <TypeToggle
                  label="Multiple choice"
                  on={config.mc}
                  set={(v) => setConfig({ ...config, mc: v })}
                />
                <TypeToggle
                  label="True / false"
                  on={config.tf}
                  set={(v) => setConfig({ ...config, tf: v })}
                />
                <TypeToggle
                  label="Matching"
                  on={config.match}
                  set={(v) => setConfig({ ...config, match: v })}
                />
              </div>
            </div>
          </div>
          <button className="qbtn qbtn-primary mt-6 w-full" onClick={build}>
            Start test
          </button>
        </div>
      </div>
    );
  }

  return (
    <TestRunner
      set={set}
      questions={questions}
      answers={answers}
      setAnswers={setAnswers}
      submitted={submitted}
      onSubmit={(score) => {
        setSubmitted(true);
        recordScore(set.id, "testBest", score);
      }}
      onRetake={build}
    />
  );
}

function TypeToggle({
  label,
  on,
  set,
}: {
  label: string;
  on: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => set(!on)}
      className={
        "flex items-center justify-between rounded-lg border-2 px-3 py-2 text-sm font-bold " +
        (on
          ? "border-assembly text-assembly bg-assembly/5"
          : "border-line-c text-muted-c")
      }
    >
      {label}
      <span>{on ? "✓" : ""}</span>
    </button>
  );
}

function TestRunner({
  set,
  questions,
  answers,
  setAnswers,
  submitted,
  onSubmit,
  onRetake,
}: {
  set: ReturnType<typeof Object> & any;
  questions: Q[];
  answers: Record<number, unknown>;
  setAnswers: (a: Record<number, unknown>) => void;
  submitted: boolean;
  onSubmit: (score: number) => void;
  onRetake: () => void;
}) {
  const grade = useMemo(() => {
    let correct = 0;
    let gradable = 0;
    questions.forEach((q, i) => {
      if (q.kind === "match") {
        const map = (answers[i] as Record<string, string>) ?? {};
        q.pairs.forEach((p) => {
          gradable++;
          if (map[p.id] === p.id) correct++;
        });
      } else {
        gradable++;
        if (isQCorrect(q, answers[i])) correct++;
      }
    });
    return { correct, gradable, pct: gradable ? Math.round((correct / gradable) * 100) : 0 };
  }, [questions, answers]);

  const set2 = (i: number, v: unknown) => setAnswers({ ...answers, [i]: v });

  return (
    <div>
      <StudyHeader
        setId={set.id}
        title={`Test · ${set.title}`}
        right={
          submitted ? (
            <span className="font-black text-assembly">{grade.pct}%</span>
          ) : undefined
        }
      />
      <div className="mx-auto max-w-[720px] px-4 py-6 space-y-4">
        {submitted && (
          <div
            className="surface rounded-2xl border border-line-c p-6 text-center pop-in"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="text-4xl font-black text-assembly">{grade.pct}%</div>
            <p className="mt-1 text-muted-c">
              {grade.correct} of {grade.gradable} correct
            </p>
            <button className="qbtn qbtn-primary mt-4" onClick={onRetake}>
              Take a new test
            </button>
          </div>
        )}

        {questions.map((q, i) => (
          <QuestionCard
            key={i}
            index={i}
            q={q}
            value={answers[i]}
            onChange={(v) => set2(i, v)}
            submitted={submitted}
          />
        ))}

        {!submitted && (
          <button
            className="qbtn qbtn-primary w-full"
            onClick={() => onSubmit(grade.pct)}
          >
            Submit test
          </button>
        )}
      </div>
    </div>
  );
}

function isQCorrect(q: Q, answer: unknown): boolean {
  if (q.kind === "written") return isCorrect(String(answer ?? ""), q.term.term);
  if (q.kind === "mc") return answer === q.term.id;
  if (q.kind === "tf") return answer === q.isTrue;
  return false;
}

function QuestionCard({
  index,
  q,
  value,
  onChange,
  submitted,
}: {
  index: number;
  q: Q;
  value: unknown;
  onChange: (v: unknown) => void;
  submitted: boolean;
}) {
  const correct = q.kind !== "match" && submitted && isQCorrect(q, value);
  const wrong = q.kind !== "match" && submitted && !correct;

  return (
    <div
      className={
        "surface rounded-2xl border-2 p-6 " +
        (submitted
          ? correct
            ? "border-correct"
            : wrong
            ? "border-incorrect"
            : "border-line-c"
          : "border-line-c")
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold tracking-wide text-muted-c">
          {index + 1} · {labelFor(q.kind)}
        </span>
        {submitted && q.kind !== "match" && (
          <span className={correct ? "text-correct" : "text-incorrect"}>
            {correct ? <IcCheck size={18} /> : <IcX size={18} />}
          </span>
        )}
      </div>

      {q.kind === "written" && (
        <>
          <div className="text-xl font-medium text-heading-c">{q.term.definition}</div>
          <input
            disabled={submitted}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Your answer"
            className="mt-4 w-full rounded-xl border-2 border-line-c bg-transparent p-3 text-heading-c outline-none focus:border-assembly"
          />
          {submitted && wrong && (
            <div className="mt-2 text-sm text-muted-c">
              Answer: <span className="font-bold text-correct">{q.term.term}</span>
            </div>
          )}
        </>
      )}

      {q.kind === "mc" && (
        <>
          <div className="text-xl font-medium text-heading-c">{q.term.definition}</div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {q.choices.map((c) => {
              const picked = value === c.id;
              const isAns = c.id === q.term.id;
              let cls = "border-line-c text-heading-c";
              if (submitted) {
                if (isAns) cls = "border-correct bg-correct-bg";
                else if (picked) cls = "border-incorrect bg-incorrect-bg";
              } else if (picked) cls = "border-assembly bg-assembly/5";
              return (
                <button
                  key={c.id}
                  disabled={submitted}
                  onClick={() => onChange(c.id)}
                  className={"rounded-xl border-2 p-3 text-left font-medium " + cls}
                >
                  {c.term}
                </button>
              );
            })}
          </div>
        </>
      )}

      {q.kind === "tf" && (
        <>
          <div className="text-lg text-heading-c">
            <span className="font-bold">{q.term.term}</span>
            <span className="text-muted-c"> matches </span>
            <span className="italic">“{q.shownDef}”</span>
          </div>
          <div className="mt-4 flex gap-3">
            {[true, false].map((tv) => {
              const picked = value === tv;
              const isAns = tv === q.isTrue;
              let cls = "border-line-c text-heading-c";
              if (submitted) {
                if (isAns) cls = "border-correct bg-correct-bg";
                else if (picked) cls = "border-incorrect bg-incorrect-bg";
              } else if (picked) cls = "border-assembly bg-assembly/5";
              return (
                <button
                  key={String(tv)}
                  disabled={submitted}
                  onClick={() => onChange(tv)}
                  className={"flex-1 rounded-xl border-2 p-3 font-bold " + cls}
                >
                  {tv ? "True" : "False"}
                </button>
              );
            })}
          </div>
        </>
      )}

      {q.kind === "match" && (
        <MatchQuestion q={q} value={value as Record<string, string>} onChange={onChange} submitted={submitted} />
      )}
    </div>
  );
}

function MatchQuestion({
  q,
  value,
  onChange,
  submitted,
}: {
  q: MatchQ;
  value?: Record<string, string>;
  onChange: (v: unknown) => void;
  submitted: boolean;
}) {
  const defsOrder = useMemo(() => shuffle(q.pairs), [q]);
  const map = value ?? {};
  return (
    <div>
      <div className="mb-3 text-sm font-bold text-muted-c">
        Match each term with its definition
      </div>
      <div className="space-y-2">
        {q.pairs.map((term) => {
          const chosen = map[term.id];
          const ok = submitted && chosen === term.id;
          const bad = submitted && chosen !== term.id;
          return (
            <div key={term.id} className="flex items-center gap-3">
              <div className="w-1/3 font-bold text-heading-c">{term.term}</div>
              <select
                disabled={submitted}
                value={chosen ?? ""}
                onChange={(e) => onChange({ ...map, [term.id]: e.target.value })}
                className={
                  "flex-1 rounded-lg border-2 bg-transparent p-2 text-heading-c outline-none " +
                  (ok
                    ? "border-correct bg-correct-bg"
                    : bad
                    ? "border-incorrect bg-incorrect-bg"
                    : "border-line-c focus:border-assembly")
                }
              >
                <option value="">— choose —</option>
                {defsOrder.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.definition}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function labelFor(k: Kind) {
  return { written: "Written", mc: "Multiple choice", tf: "True / False", match: "Matching" }[k];
}
