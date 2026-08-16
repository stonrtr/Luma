"use client";
import { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";
import type { AppState, Schedule } from "./types";
import type { Mutation } from "./db";

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
}

// Локальный редьюсер — зеркалит серверный applyMutation, чтобы UI обновлялся мгновенно.
function reduce(s: AppState, m: Mutation): AppState {
  const nowIso = new Date().toISOString();
  switch (m.action) {
    case "addGoal":
      return { ...s, goals: [...s.goals, { id: m.id, directionId: null, name: m.name, type: m.type, ord: s.goals.length, status: "active", createdAt: nowIso }] };
    case "renameGoal":
      return { ...s, goals: s.goals.map((g) => (g.id === m.id ? { ...g, name: m.name } : g)) };
    case "setGoalStatus":
      return m.status === "archived"
        ? { ...s, goals: s.goals.filter((g) => g.id !== m.id) }
        : { ...s, goals: s.goals.map((g) => (g.id === m.id ? { ...g, status: m.status } : g)) };
    case "addTask":
      return { ...s, tasks: [...s.tasks, { id: m.id, goalId: m.goalId, title: m.title, dueDate: m.dueDate, doneAt: null, ord: s.tasks.length, createdAt: nowIso, updatedAt: nowIso }] };
    case "toggleTask":
      return { ...s, tasks: s.tasks.map((t) => (t.id === m.id ? { ...t, doneAt: m.done ? nowIso : null, updatedAt: nowIso } : t)) };
    case "setTaskDue":
      return { ...s, tasks: s.tasks.map((t) => (t.id === m.id ? { ...t, dueDate: m.dueDate, updatedAt: nowIso } : t)) };
    case "deleteTask":
      return { ...s, tasks: s.tasks.filter((t) => t.id !== m.id) };
    case "addHabit":
      return { ...s, habits: [...s.habits, { id: m.id, goalId: m.goalId, directionId: null, name: m.name, schedule: m.schedule, archived: false, ord: s.habits.length, createdAt: nowIso }] };
    case "archiveHabit":
      return { ...s, habits: s.habits.filter((h) => h.id !== m.id) };
    case "toggleHabitEntry": {
      if (m.date > s.today) return s;
      const existing = s.entries.find((e) => e.habitId === m.habitId && e.date === m.date);
      if (existing) {
        return { ...s, entries: s.entries.map((e) => (e === existing ? { ...e, done: !e.done, updatedAt: nowIso } : e)) };
      }
      return { ...s, entries: [...s.entries, { id: m.id, habitId: m.habitId, date: m.date, done: true, updatedAt: nowIso }] };
    }
    default:
      return s;
  }
}

async function persist(m: Mutation) {
  try {
    await fetch("/api/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: [m] }),
    });
  } catch {
    /* локальное состояние — источник правды для UI; сеть best-effort */
  }
}

interface Store {
  state: AppState;
  addGoal: (name: string, type: "achievement" | "maintenance") => void;
  renameGoal: (id: string, name: string) => void;
  setGoalStatus: (id: string, status: "active" | "done" | "archived") => void;
  addTask: (goalId: string | null, title: string, dueDate: string | null) => void;
  toggleTask: (id: string, done: boolean) => void;
  setTaskDue: (id: string, dueDate: string | null) => void;
  deleteTask: (id: string) => void;
  addHabit: (goalId: string | null, name: string, schedule: Schedule) => void;
  archiveHabit: (id: string) => void;
  toggleHabitEntry: (habitId: string, date: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ initial, children }: { initial: AppState; children: ReactNode }) {
  const [state, dispatch] = useReducer((s: AppState, m: Mutation) => reduce(s, m), initial);

  const run = useCallback((m: Mutation) => {
    dispatch(m);
    void persist(m);
  }, []);

  const store: Store = {
    state,
    addGoal: (name, type) => run({ action: "addGoal", id: uid(), name, type }),
    renameGoal: (id, name) => run({ action: "renameGoal", id, name }),
    setGoalStatus: (id, status) => run({ action: "setGoalStatus", id, status }),
    addTask: (goalId, title, dueDate) => run({ action: "addTask", id: uid(), goalId, title, dueDate }),
    toggleTask: (id, done) => run({ action: "toggleTask", id, done }),
    setTaskDue: (id, dueDate) => run({ action: "setTaskDue", id, dueDate }),
    deleteTask: (id) => run({ action: "deleteTask", id }),
    addHabit: (goalId, name, schedule) => run({ action: "addHabit", id: uid(), goalId, name, schedule }),
    archiveHabit: (id) => run({ action: "archiveHabit", id }),
    toggleHabitEntry: (habitId, date) => run({ action: "toggleHabitEntry", id: uid(), habitId, date }),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore вне StoreProvider");
  return s;
}
