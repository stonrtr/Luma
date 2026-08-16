import type { AppState, Task } from "./types";
import { sundayOf, endOfMonth } from "./date";

/** Задачи, попадающие в «Сегодня»: дедлайн = сегодня + инбокс без даты. */
export function todayOpenTasks(s: AppState): Task[] {
  return s.tasks
    .filter((t) => !t.doneAt && (t.dueDate === s.today || (t.dueDate === null && t.goalId === null)))
    .sort((a, b) => a.ord - b.ord);
}

export function todayDoneTasks(s: AppState): Task[] {
  return s.tasks
    .filter(
      (t) =>
        t.doneAt &&
        (t.dueDate === s.today ||
          (t.dueDate === null && t.goalId === null && t.doneAt.slice(0, 10) === s.today)),
    )
    .sort((a, b) => a.ord - b.ord);
}

/** Просроченные незакрытые задачи (дедлайн в прошлом). */
export function overdueTasks(s: AppState): Task[] {
  return s.tasks
    .filter((t) => !t.doneAt && t.dueDate !== null && t.dueDate < s.today)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
}

// ---- горизонты планирования (открытые задачи с датой в будущем) ----

export type Horizon = "week" | "month" | "future";

export function horizonTasks(s: AppState, h: Horizon): Task[] {
  const wEnd = sundayOf(s.today);
  const mEnd = endOfMonth(s.today);
  const later = wEnd > mEnd ? wEnd : mEnd;
  return s.tasks
    .filter((t) => {
      if (t.doneAt || !t.dueDate || t.dueDate <= s.today) return false;
      if (h === "week") return t.dueDate <= wEnd;
      if (h === "month") return t.dueDate > wEnd && t.dueDate <= mEnd;
      return t.dueDate > later; // future
    })
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : a.ord - b.ord));
}

export function horizonCount(s: AppState, h: Horizon): number {
  return horizonTasks(s, h).length;
}
