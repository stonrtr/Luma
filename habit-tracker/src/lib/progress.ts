// Единственное место, где живут расчёты прогресса и серий (см. §4 ТЗ).
// Все функции чистые: принимают срез данных, ничего не читают снаружи.

import { addDays, diffDays, isoWeekday } from "./date";
import type { Goal, Habit, HabitEntry, Task } from "./types";

/** Запланирован ли день для привычки по её расписанию (без учёта даты создания). */
export function isScheduled(habit: Habit, dateStr: string): boolean {
  const s = habit.schedule;
  if (s.type === "daily") return true;
  if (s.type === "weekdays") return (s.days ?? []).includes(isoWeekday(dateStr));
  return true; // weekly: конкретных дней нет, любой день допустим
}

type EntryIndex = Map<string, Map<string, boolean>>; // habitId -> (date -> done)

export function indexEntries(entries: HabitEntry[]): EntryIndex {
  const idx: EntryIndex = new Map();
  for (const e of entries) {
    let m = idx.get(e.habitId);
    if (!m) {
      m = new Map();
      idx.set(e.habitId, m);
    }
    m.set(e.date, e.done);
  }
  return idx;
}

function doneOn(idx: EntryIndex, habitId: string, date: string): boolean {
  return idx.get(habitId)?.get(date) === true;
}

/**
 * adherence(habit, N) = выполнено / запланировано за окно N дней (включая сегодня).
 * Дни до создания привычки не учитываются.
 */
export function adherence(habit: Habit, idx: EntryIndex, today: string, N = 30): number {
  const createdDay = habit.createdAt.slice(0, 10);
  const start = addDays(today, -(N - 1));
  const from = start < createdDay ? createdDay : start;

  if (habit.schedule.type === "weekly") {
    const per = Math.max(1, habit.schedule.timesPerWeek ?? 1);
    const span = diffDays(today, from) + 1;
    if (span <= 0) return 0;
    const expected = (per * span) / 7;
    if (expected <= 0) return 0;
    let done = 0;
    for (let d = from; d <= today; d = addDays(d, 1)) if (doneOn(idx, habit.id, d)) done++;
    return Math.min(1, done / expected);
  }

  let planned = 0;
  let done = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    planned++;
    if (doneOn(idx, habit.id, d)) done++;
  }
  return planned === 0 ? 0 : done / planned;
}

/**
 * Серия — подряд идущие выполненные дни от сегодня назад (по галочкам, без учёта
 * расписания). Сегодня не рвёт серию, если ещё не отмечено.
 */
export function streak(
  habit: Habit,
  idx: EntryIndex,
  today: string,
): { value: number; unit: "дней" } {
  const createdDay = habit.createdAt.slice(0, 10);
  let count = 0;
  let d = today;
  if (doneOn(idx, habit.id, d)) count++;
  d = addDays(d, -1);
  while (d >= createdDay) {
    if (doneOn(idx, habit.id, d)) count++;
    else break;
    d = addDays(d, -1);
  }
  return { value: count, unit: "дней" };
}

/**
 * Прогресс цели. achievement: задачи 0.7 + привычки 0.3 (если привычек нет — только задачи).
 * maintenance: среднее adherence(30) по привычкам.
 */
export function goalProgress(
  goal: Goal,
  tasks: Task[],
  habits: Habit[],
  idx: EntryIndex,
  today: string,
): number {
  const gTasks = tasks.filter((t) => t.goalId === goal.id);
  const gHabits = habits.filter((h) => h.goalId === goal.id && !h.archived);

  const habitsPart = gHabits.length
    ? gHabits.reduce((s, h) => s + adherence(h, idx, today, 30), 0) / gHabits.length
    : 0;

  if (goal.type === "maintenance") return habitsPart;

  const tasksPart = gTasks.length ? gTasks.filter((t) => t.doneAt).length / gTasks.length : 0;
  if (!gHabits.length) return tasksPart;
  return tasksPart * 0.7 + habitsPart * 0.3;
}

/** Прогресс направления — среднее по активным целям. */
export function directionProgress(
  directionId: string,
  goals: Goal[],
  tasks: Task[],
  habits: Habit[],
  idx: EntryIndex,
  today: string,
): number {
  const active = goals.filter((g) => g.directionId === directionId && g.status === "active");
  if (!active.length) return 0;
  return active.reduce((s, g) => s + goalProgress(g, tasks, habits, idx, today), 0) / active.length;
}

/**
 * Заполненность дня = (закрытые задачи дня + выполненные привычки дня) /
 * (всего задач дня + всего запланированных привычек дня).
 */
export function dayCompletion(
  date: string,
  tasks: Task[],
  habits: Habit[],
  idx: EntryIndex,
): number {
  const dayTasks = tasks.filter((t) => t.dueDate === date);
  const dayHabits = habits.filter(
    (h) => !h.archived && h.createdAt.slice(0, 10) <= date && isScheduled(h, date),
  );
  const total = dayTasks.length + dayHabits.length;
  if (!total) return 0;
  const done =
    dayTasks.filter((t) => t.doneAt).length +
    dayHabits.filter((h) => doneOn(idx, h.id, date)).length;
  return done / total;
}

// ---- momentum: движение по цели (задачи + привычки), без «% готовности» ----

export type MomentumStatus = "active" | "slowing" | "stalled" | "idle";

export interface Momentum {
  status: MomentumStatus;
  label: string;
  activeDays: number; // дней с активностью за последние N
  lastActive: string | null;
  dots: boolean[]; // N дней (старый→новый): была ли активность по цели
  jumps: number; // прыжки — закрытые задачи цели (всего)
  steps: number; // шаги — выполненные привычки цели (всего отметок)
}

const MOMENTUM_LABEL: Record<MomentumStatus, string> = {
  active: "в движении",
  slowing: "замедляется",
  stalled: "застой",
  idle: "нет активности",
};

/**
 * Движение по цели за последние N дней. Активность дня = в этот день закрыта
 * задача цели ИЛИ выполнена её привычка. Привычки ведут к цели наравне с задачами.
 */
export function goalMomentum(
  goal: Goal,
  tasks: Task[],
  habits: Habit[],
  idx: EntryIndex,
  today: string,
  N = 14,
): Momentum {
  const gTasks = tasks.filter((t) => t.goalId === goal.id);
  const gHabits = habits.filter((h) => h.goalId === goal.id && !h.archived);
  const hasItems = gTasks.length > 0 || gHabits.length > 0;

  const activeSet = new Set<string>();
  let jumps = 0;
  let steps = 0;
  for (const t of gTasks) if (t.doneAt) {
    activeSet.add(t.doneAt.slice(0, 10));
    jumps++;
  }
  for (const h of gHabits) {
    const m = idx.get(h.id);
    if (m) for (const [date, done] of m) if (done) {
      activeSet.add(date);
      steps++;
    }
  }

  const dots: boolean[] = [];
  let activeDays = 0;
  for (let i = N - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const on = activeSet.has(d);
    dots.push(on);
    if (on) activeDays++;
  }

  let lastActive: string | null = null;
  for (const d of activeSet) if (!lastActive || d > lastActive) lastActive = d;
  const daysSince = lastActive ? diffDays(today, lastActive) : Infinity;

  let status: MomentumStatus;
  if (!hasItems || lastActive === null) status = "idle";
  else if (daysSince <= 2) status = "active";
  else if (daysSince <= 6) status = "slowing";
  else status = "stalled";

  return { status, label: MOMENTUM_LABEL[status], activeDays, lastActive, dots, jumps, steps };
}
