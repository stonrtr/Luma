import type { Momentum } from "@/lib/progress";
import { jumpsText, stepsText } from "@/lib/plural";
import { TaskIcon, HabitIcon } from "./icons";

export function MomentumTag({ m }: { m: Momentum }) {
  return (
    <span className={`mo ${m.status}`}>
      <span className="mo-dot" />
      {m.label}
    </span>
  );
}

export function MomentumDot({ m }: { m: Momentum }) {
  return <span className={`mo ${m.status}`}><span className="mo-dot" /></span>;
}

/** Счёт достижений к цели: задачи и привычки, словами. Без процентов. */
export function Tally({ m, size }: { m: Momentum; size?: "lg" }) {
  return (
    <span className={`tally${size === "lg" ? " lg" : ""}`}>
      <span className="tally-j">
        <span className="ic ic-task"><TaskIcon /></span> {jumpsText(m.jumps)}
      </span>
      <span className="tally-s">
        <span className="ic ic-habit"><HabitIcon /></span> {stepsText(m.steps)}
      </span>
    </span>
  );
}

/** Компактный счёт числами (для рейки). */
export function Counts({ m }: { m: Momentum }) {
  return (
    <span className="counts">
      <span className="tally-j">
        <span className="ic ic-task"><TaskIcon /></span> {m.jumps}
      </span>
      <span className="tally-s">
        <span className="ic ic-habit"><HabitIcon /></span> {m.steps}
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
