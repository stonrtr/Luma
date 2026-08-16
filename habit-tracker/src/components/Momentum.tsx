import type { Momentum } from "@/lib/progress";
import { jumpsText, stepsText } from "@/lib/plural";

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

/** Счёт достижений к цели: прыжки (задачи) и шаги (привычки). Без процентов. */
export function Tally({ m, size }: { m: Momentum; size?: "lg" }) {
  return (
    <span className={`tally${size === "lg" ? " lg" : ""}`}>
      <span className="tally-j">🦘 {jumpsText(m.jumps)}</span>
      <span className="tally-s">👣 {stepsText(m.steps)}</span>
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
