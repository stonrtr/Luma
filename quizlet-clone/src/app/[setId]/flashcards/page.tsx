"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { speak } from "@/lib/speech";
import { shuffle } from "@/lib/util";
import StudyHeader from "@/components/StudyHeader";
import {
  IcArrowLeft,
  IcArrowRight,
  IcShuffle,
  IcSound,
  IcStar,
  IcPlay,
  IcPause,
} from "@/components/icons";
import type { Term } from "@/lib/types";

export default function Flashcards() {
  const { setId } = useParams<{ setId: string }>();
  const { getSet, ready, data, toggleStar, touchRecent } = useStore();
  const set = getSet(setId);

  const [order, setOrder] = useState<Term[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [stillLearning, setStillLearning] = useState<Set<string>>(new Set());

  const base = useMemo(() => {
    if (!set) return [];
    const src = starredOnly ? set.terms.filter((t) => t.starred) : set.terms;
    return src;
  }, [set, starredOnly]);

  useEffect(() => {
    setOrder(shuffled ? shuffle(base) : base);
    setI(0);
    setFlipped(false);
  }, [base, shuffled]);

  useEffect(() => {
    if (set) touchRecent(set.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id]);

  const card = order[i];

  const next = useCallback(() => {
    setFlipped(false);
    setI((v) => (v + 1) % Math.max(order.length, 1));
  }, [order.length]);

  const prev = useCallback(() => {
    setFlipped(false);
    setI((v) => (v - 1 + order.length) % Math.max(order.length, 1));
  }, [order.length]);

  // autoplay
  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => {
      if (!flipped) setFlipped(true);
      else next();
    }, 2200);
    return () => clearTimeout(t);
  }, [autoplay, flipped, next, i]);

  // keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev]);

  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;
  if (!set) return <div className="p-10 text-center">Set not found.</div>;
  if (order.length === 0)
    return (
      <div className="p-16 text-center text-muted-c">
        No cards to study. {starredOnly && "Star some terms first."}
      </div>
    );

  const mark = (list: "known" | "learning") => {
    if (!card) return;
    if (list === "known") {
      setKnown((s) => new Set(s).add(card.id));
      setStillLearning((s) => {
        const n = new Set(s);
        n.delete(card.id);
        return n;
      });
    } else {
      setStillLearning((s) => new Set(s).add(card.id));
    }
    next();
  };

  const progress = ((i + 1) / order.length) * 100;
  const done = known.size + stillLearning.size === order.length && order.length > 0;

  return (
    <div>
      <StudyHeader
        setId={set.id}
        title={set.title}
        right={
          <div className="flex items-center gap-1">
            <ToggleBtn
              active={shuffled}
              onClick={() => setShuffled((v) => !v)}
              title="Shuffle"
            >
              <IcShuffle size={18} />
            </ToggleBtn>
            <ToggleBtn
              active={autoplay}
              onClick={() => setAutoplay((v) => !v)}
              title="Play"
            >
              {autoplay ? <IcPause size={18} /> : <IcPlay size={18} />}
            </ToggleBtn>
            <ToggleBtn
              active={starredOnly}
              onClick={() => setStarredOnly((v) => !v)}
              title="Starred only"
            >
              <IcStar size={18} filled={starredOnly} />
            </ToggleBtn>
          </div>
        }
      />

      <div className="mx-auto max-w-[760px] px-4 py-6">
        {/* progress counters */}
        <div className="mb-2 flex items-center justify-between text-sm font-bold">
          <span className="text-incorrect">{stillLearning.size} Still learning</span>
          <span className="text-muted-c">
            {i + 1} / {order.length}
          </span>
          <span className="text-correct">{known.size} Known</span>
        </div>
        <div className="mb-4 h-1.5 w-full rounded bg-line-c overflow-hidden">
          <div
            className="h-full bg-assembly transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Card */}
        <div className="flip-scene">
          <button
            className={"flip-card w-full text-left " + (flipped ? "is-flipped" : "")}
            onClick={() => setFlipped((v) => !v)}
            style={{ height: 420 }}
          >
            <Face>
              <Corner
                onStar={() => toggleStar(set.id, card.id)}
                starred={card.starred}
                onSound={() =>
                  speak(card.term, set.termLang, data.settings.soundOn)
                }
                label="TERM"
              />
              <div className="text-2xl md:text-3xl font-medium text-heading-c text-center px-6">
                {card.term}
              </div>
            </Face>
            <Face back>
              <Corner
                onStar={() => toggleStar(set.id, card.id)}
                starred={card.starred}
                onSound={() =>
                  speak(card.definition, set.defLang, data.settings.soundOn)
                }
                label="DEFINITION"
              />
              <div className="text-2xl md:text-3xl font-medium text-heading-c text-center px-6">
                {card.definition}
              </div>
              {card.termImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.termImage}
                  alt=""
                  className="mt-4 max-h-40 rounded-lg object-contain"
                />
              )}
            </Face>
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-muted-c">
          Press Space to flip · ← → to navigate
        </p>

        {/* Sort controls */}
        <div className="mt-6 flex items-center justify-center gap-6">
          <button
            onClick={() => mark("learning")}
            className="grid h-14 w-14 place-items-center rounded-full border-2 border-incorrect text-incorrect hover:bg-incorrect/10 text-2xl font-black"
            title="Still learning"
          >
            ✕
          </button>
          <div className="flex items-center gap-2">
            <IconRound onClick={prev}>
              <IcArrowLeft />
            </IconRound>
            <IconRound onClick={next}>
              <IcArrowRight />
            </IconRound>
          </div>
          <button
            onClick={() => mark("known")}
            className="grid h-14 w-14 place-items-center rounded-full border-2 border-correct text-correct hover:bg-correct/10 text-2xl font-black"
            title="Got it"
          >
            ✓
          </button>
        </div>

        {done && (
          <div className="surface mt-8 rounded-2xl border border-line-c p-6 text-center pop-in">
            <div className="text-lg font-black text-heading-c">Nice work! 🎉</div>
            <p className="mt-1 text-muted-c">
              You knew {known.size} and are still learning {stillLearning.size}.
            </p>
            <button
              className="qbtn qbtn-primary mt-4"
              onClick={() => {
                setKnown(new Set());
                setStillLearning(new Set());
                setI(0);
                setFlipped(false);
              }}
            >
              Restart Flashcards
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Face({
  children,
  back,
}: {
  children: React.ReactNode;
  back?: boolean;
}) {
  return (
    <div
      className={
        "flip-face surface grid place-items-center rounded-2xl border border-line-c " +
        (back ? "flip-face-back" : "")
      }
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}

function Corner({
  onStar,
  starred,
  onSound,
  label,
}: {
  onStar: () => void;
  starred?: boolean;
  onSound: () => void;
  label: string;
}) {
  return (
    <>
      <span className="absolute left-5 top-4 text-xs font-bold tracking-wide text-muted-c">
        {label}
      </span>
      <div className="absolute right-4 top-3 flex gap-1">
        <span
          role="button"
          tabIndex={0}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-c hover:bg-canvas-c"
          onClick={(e) => {
            e.stopPropagation();
            onSound();
          }}
        >
          <IcSound size={18} />
        </span>
        <span
          role="button"
          tabIndex={0}
          className={
            "grid h-8 w-8 place-items-center rounded-full hover:bg-canvas-c " +
            (starred ? "text-star" : "text-muted-c")
          }
          onClick={(e) => {
            e.stopPropagation();
            onStar();
          }}
        >
          <IcStar size={18} filled={starred} />
        </span>
      </div>
    </>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        "grid h-9 w-9 place-items-center rounded-full " +
        (active ? "bg-assembly text-white" : "text-heading-c hover:bg-white/60")
      }
    >
      {children}
    </button>
  );
}

function IconRound({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full border border-line-c surface text-heading-c hover:border-assembly"
    >
      {children}
    </button>
  );
}
