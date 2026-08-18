import type { Goal } from "./types";

// Яркая «радужная» палитра — по одному цвету на цель (идентичность цели).
const PALETTE = [
  "#ff5d5d", // красный
  "#ff9f43", // оранжевый
  "#f7c948", // жёлтый
  "#3fbf6f", // зелёный
  "#22c1c3", // бирюзовый
  "#5b8def", // синий
  "#9d6bff", // фиолетовый
  "#ff6bd0", // розовый
];

/** Стабильный цвет цели по её позиции среди активных целей. */
export function goalColor(goalId: string, goals: Goal[]): string {
  const active = goals.filter((g) => g.status === "active").sort((a, b) => a.ord - b.ord);
  const i = active.findIndex((g) => g.id === goalId);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}
