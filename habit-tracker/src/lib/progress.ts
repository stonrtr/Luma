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
 * Серия. Для daily/weekdays — подряд выполненные запланированные дни от сегодня назад
 * (незапланированные пропускаются, не рвут серию). Для weekly — подряд закрытые недели.
 */
export function streak(
  habit: Habit,
  idx: EntryIndex,
  today: string,
): { value: number; unit: "дней" | "недель" } {
  if (habit.schedule.type === "weekly") {
    const per = Math.max(1, habit.schedule.timesPerWeek ?? 1);
    const doneInWeek = (monday: string) => {
      let n = 0;
      for (let i = 0; i < 7; i++) if (doneOn(idx, habit.id, addDays(monday, i))) n++;
      return n;
    };
    const mondayOfToday = addDays(today, 1 - isoWeekday(today));
    let weeks = 0;
    // текущая неделя засчитывается только если цель уже достигнута
    if (doneInWeek(mondayOfToday) >= per) weeks++;
    let m = addDays(mondayOfToday, -7);
    while (doneInWeek(m) >= per) {
      weeks++;
      m = addDays(m, -7);
      if (weeks > 520) break;
    }
    return { value: weeks, unit: "недель" };
  }

  const createdDay = habit.createdAt.slice(0, 10);
  let count = 0;
  let d = today;
  // сегодня не рвёт серию, если ещё не отмечено
  if (isScheduled(habit, d) && doneOn(idx, habit.id, d)) count++;
  d = addDays(d, -1);
  while (d >= createdDay) {
    if (isScheduled(habit, d)) {
      if (doneOn(idx, habit.id, d)) count++;
      else break;
    }
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
