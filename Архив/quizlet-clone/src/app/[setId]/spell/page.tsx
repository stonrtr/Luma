"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { speak } from "@/lib/speech";
import { shuffle, isCorrect } from "@/lib/util";
import StudyHeader from "@/components/StudyHeader";
import { IcSound } from "@/components/icons";
import type { Term } from "@/lib/types";

export default function Spell() {
  const { setId } = useParams<{ setId: string }>();
  const { getSet, ready, data, touchRecent } = useStore();
  const set = getSet(setId);

  const [order, setOrder] = useState<Term[]>([]);
  const [i, setI] = useState(0);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "right" | "wrong">("idle");
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const inited = useRef(false);

  useEffect(() => {
    if (set && !inited.current) {
      inited.current = true;
      touchRecent(set.id);
      const o = shuffle(set.terms);
      setOrder(o);
      setTimeout(() => o[0] && speak(o[0].term, set.termLang, data.settings.soundOn), 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id]);

  const cur = order[i];
  const pct = useMemo(
    () => (order.length ? Math.round((i / order.length) * 100) : 0),
    [i, order.length]
  );

  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;
  if (!set) return <div className="p-10 text-center">Set not found.</div>;

  const next = (o = order) => {
    if (i + 1 >= o.length) {
      setDone(true);
      return;
    }
    setI(i + 1);
    setInput("");
    setStatus("idle");
    setTimeout(() => speak(o[i + 1].term, set.termLang, data.settings.soundOn), 250);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "idle") {
      next();
      return;
    }
    if (isCorrect(input, cur.term)) {
      setStatus("right");
      setCorrectCount((c) => c + 1);
      speak("Correct", "en", data.settings.soundOn);
      setTimeout(() => next(), 700);
    } else {
      setStatus("wrong");
    }
  };

  if (done) {
    return (
      <div>
        <StudyHeader setId={set.id} title={`Spell · ${set.title}`} />
        <div className="mx-auto max-w-[520px] px-4 py-12 text-center pop-in">
          <div className="text-5xl">✍️</div>
          <h1 className="mt-3 text-2xl font-black text-heading-c">All done!</h1>
          <p className="mt-2 text-muted-c">
            You spelled {correctCount} of {order.length} correctly.
          </p>
          <button
            className="qbtn qbtn-primary mt-6"
            onClick={() => {
              const o = shuffle(set.terms);
              setOrder(o);
              setI(0);
              setInput("");
              setStatus("idle");
              setCorrectCount(0);
              setDone(false);
              setTimeout(() => speak(o[0].term, set.termLang, data.settings.soundOn), 300);
            }}
          >
            Restart
          </button>
        </div>
      </div>
    );
  }

  if (!cur) return <div className="p-10 text-center text-muted-c">Loading…</div>;

  return (
    <div>
      <StudyHeader setId={set.id} title={`Spell · ${set.title}`} />
      <div className="mx-auto max-w-[640px] px-4 pt-4">
        <div className="h-1.5 w-full rounded bg-line-c overflow-hidden">
          <div className="h-full bg-assembly transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-8 text-center">
        <p className="text-sm font-bold text-muted-c">Listen and spell</p>
        <button
          onClick={() => speak(cur.term, set.termLang, data.settings.soundOn)}
          className="mx-auto mt-4 grid h-24 w-24 place-items-center rounded-full bg-assembly text-white hover:bg-assembly-dark"
          aria-label="Replay audio"
        >
          <IcSound size={40} />
        </button>
        <p className="mt-3 text-sm text-muted-c">Definition: {cur.definition}</p>

        <form onSubmit={submit} className="mt-8">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type what you hear"
            className={
              "w-full rounded-xl border-2 bg-transparent p-4 text-center text-xl text-heading-c outline-none " +
              (status === "right"
                ? "border-correct bg-correct-bg"
                : status === "wrong"
                ? "border-incorrect bg-incorrect-bg shake"
                : "border-line-c focus:border-assembly")
            }
          />
          {status === "wrong" && (
            <div className="mt-4 text-left surface rounded-xl border border-incorrect p-4">
              <div className="text-sm text-incorrect font-bold">
                Careful! The correct spelling is:
              </div>
              <div className="mt-1 text-lg font-bold text-heading-c">{cur.term}</div>
              <button type="submit" className="qbtn qbtn-primary mt-3">
                Got it, continue
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
