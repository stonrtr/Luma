import type { Momentum, MomentumStatus } from "@/lib/progress";
import { jumpsText, stepsText } from "@/lib/plural";
import { TaskIcon, HabitIcon } from "./icons";

const TREND: Record<MomentumStatus, { color: string; kind: "up" | "down" | "flat" }> = {
  active: { color: "#22a24b", kind: "up" },
  slowing: { color: "#d69a00", kind: "flat" },
  stalled: { color: "#ff5d5d", kind: "down" },
  idle: { color: "#a3a4ac", kind: "flat" },
};

/** Стрелка-тренд: вверх (зелёная) / вниз (красная) / вбок (жёлтая-стагнация). */
export function TrendIcon({ status }: { status: MomentumStatus }) {
  const t = TREND[status];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={t.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: "none" }}>
      {t.kind === "flat" ? (
        <path d="M2.5 8h9M11.5 8l-2-2M11.5 8l-2 2" />
      ) : t.kind === "up" ? (
        <>
          <polyline points="2.5,11 6.5,7 9,9.2 13,4.5" />
          <path d="M13 4.5H10M13 4.5V7.5" />
        </>
      ) : (
        <>
          <polyline points="2.5,5 6.5,9 9,6.8 13,11.5" />
          <path d="M13 11.5H10M13 11.5V8.5" />
        </>
      )}
    </svg>
  );
}

export function MomentumTag({ m }: { m: Momentum }) {
  return (
    <span className={`mo ${m.status}`}>
      <TrendIcon status={m.status} />
      {m.label}
    </span>
  );
}

export function MomentumDot({ m, color }: { m: Momentum; color?: string }) {
  return (
    <span className={`mo ${m.status}`}>
      <span className="mo-dot" style={color ? { background: color, boxShadow: "none" } : undefined} />
    </span>
  );
}

/** Счёт цели: задач к исполнению и активных привычек (как в рейке). */
export function Tally({ m, size }: { m: Momentum; size?: "lg" }) {
  return (
    <span className={`tally${size === "lg" ? " lg" : ""}`}>
      <span className="tally-j">
        <span className="ic ic-task"><TaskIcon /></span> {jumpsText(m.openTasks)}
      </span>
      <span className="tally-s">
        <span className="ic ic-habit"><HabitIcon /></span> {stepsText(m.habitCount)}
      </span>
    </span>
  );
}

/** Актуальное для рейки: задач к исполнению · активных привычек. */
export function Counts({ m }: { m: Momentum }) {
  return (
    <span className="counts">
      <span className="tally-j" title="Задач к исполнению">
        <span className="ic ic-task"><TaskIcon /></span> {jumpsText(m.openTasks)}
      </span>
      <span className="tally-s" title="Активных привычек">
        <span className="ic ic-habit"><HabitIcon /></span> {stepsText(m.habitCount)}
      </span>
    </span>
  );
}

/** Полоска активности за N дней — есть ли движение, без чисел и процентов. */
export function ActivityStrip({ dots }: { dots: boolean[] }) {
  return (
    <span className="strip" aria-hidden>
      {dots.map((on, i) => (
        <i key={i} className={on ? "on" : ""} />
      ))}
    </span>
  );
}
