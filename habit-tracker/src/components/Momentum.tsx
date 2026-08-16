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

/**
 * Схематичный «метр» действий: две мини-шкалы — прыжки (задачи) и шаги (привычки),
 * длина относительно самой активной цели. Сравнимо между целями, без чисел и процентов.
 */
export function ActionMeter({
  jumps,
  steps,
  maxJumps,
  maxSteps,
}: {
  jumps: number;
  steps: number;
  maxJumps: number;
  maxSteps: number;
}) {
  const w = (v: number, max: number) => (v <= 0 ? 0 : Math.max(14, Math.round((v / Math.max(max, 1)) * 100)));
  return (
    <span className="ameter" aria-hidden>
      <span className="am" title="прыжки — задачи">
        <span className="am-ico">🦘</span>
        <span className="am-bar"><i className="j" style={{ width: `${w(jumps, maxJumps)}%` }} /></span>
      </span>
      <span className="am" title="шаги — привычки">
        <span className="am-ico">👣</span>
        <span className="am-bar"><i className="s" style={{ width: `${w(steps, maxSteps)}%` }} /></span>
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
