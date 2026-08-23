"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppData, AppSettings, Goal, Habit, HabitDayStatus, HabitLog, LifeArea, Tag, Task, ID } from "./types";
import { todayKey, addDays, toKey, fromKey } from "./date";

const LS_KEY = "griply-clone-v1";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const DEFAULT_AREAS: Omit<LifeArea, "id">[] = [
  { name: "Работа и карьера", icon: "briefcase", color: "#3b9eff", order: 0 },
  { name: "Спорт и здоровье", icon: "ball", color: "#f76b15", order: 1 },
  { name: "Деньги и финансы", icon: "card", color: "#46a758", order: 2 },
  { name: "Личное развитие", icon: "person", color: "#8347b9", order: 3 },
  { name: "Отдых и развлечения", icon: "smile", color: "#ffc53d", order: 4 },
  { name: "Образование и обучение", icon: "book", color: "#0d74ce", order: 5 },
  { name: "Семья и друзья", icon: "people", color: "#e5484d", order: 6 },
  { name: "Любовь и отношения", icon: "rings", color: "#d6409f", order: 7 },
  { name: "Духовность", icon: "lotus", color: "#12a594", order: 8 },
];

// перевод дефолтных сфер, созданных до русификации
const AREA_NAME_MIGRATION: Record<string, string> = {
  "Work & Career": "Работа и карьера",
  "Sport & Health": "Спорт и здоровье",
  "Money & Finance": "Деньги и финансы",
  "Personal development": "Личное развитие",
  "Fun & Relaxation": "Отдых и развлечения",
  "Education & Learning": "Образование и обучение",
  "Family & Friends": "Семья и друзья",
  "Love & Relationships": "Любовь и отношения",
  "Spirituality": "Духовность",
};

function seed(): AppData {
  return {
    settings: { theme: "system", lang: "ru", notifications: false },
    calendarEvents: [],
    areas: DEFAULT_AREAS.map((a) => ({ ...a, id: uid() })),
    goals: [],
    tasks: [],
    habits: [],
    habitLogs: [],
    tags: [],
    gettingStartedCollapsed: false,
    gettingStartedDismissed: false,
  };
}

function load(): AppData {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return seed();
    const data: AppData = { ...seed(), ...JSON.parse(raw) };
    data.areas = data.areas.map((a) =>
      AREA_NAME_MIGRATION[a.name] ? { ...a, name: AREA_NAME_MIGRATION[a.name] } : a
    );
    return data;
  } catch {
    return seed();
  }
}

export interface Store {
  data: AppData;
  set: (fn: (d: AppData) => AppData) => void;
  // helpers
  addTask: (t: Partial<Task> & { title: string }) => Task;
  updateTask: (id: ID, patch: Partial<Task>) => void;
  toggleTask: (id: ID) => void;
  addGoal: (g: Partial<Goal> & { name: string }) => Goal;
  updateGoal: (id: ID, patch: Partial<Goal>) => void;
  deleteGoal: (id: ID) => void;
  addHabit: (h: Partial<Habit> & { name: string }) => Habit;
  updateHabit: (id: ID, patch: Partial<Habit>) => void;
  deleteHabit: (id: ID) => void;
  addArea: (a: Partial<LifeArea> & { name: string }) => LifeArea;
  updateArea: (id: ID, patch: Partial<LifeArea>) => void;
  deleteArea: (id: ID) => void;
  addTag: (name: string, color: string) => Tag;
  updateTag: (id: ID, patch: Partial<Tag>) => void;
  deleteTag: (id: ID) => void;
  moveTaskBefore: (dragId: ID, targetId: ID) => void;
  logHabit: (habitId: ID, date: string, count: number, status?: HabitDayStatus | null, movedTo?: string | null) => void;
  habitCount: (habitId: ID, date: string) => number;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(seed);
  const [ready, setReady] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    setData(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (ready) localStorage.setItem(LS_KEY, JSON.stringify(data));
  }, [data, ready]);

  // синхронизация между вкладками: чужая запись в localStorage подтягивается сюда,
  // чтобы вкладка с устаревшим состоянием не затёрла свежие данные
  useEffect(() => {
    const fn = (e: StorageEvent) => {
      if (e.key === LS_KEY && e.newValue) {
        try {
          first.current = true; // не переписывать storage тем же значением
          setData({ ...seed(), ...JSON.parse(e.newValue) });
        } catch { /* повреждённое значение игнорируем */ }
      }
    };
    window.addEventListener("storage", fn);
    return () => window.removeEventListener("storage", fn);
  }, []);

  // применяем тему к <html data-theme>
  useEffect(() => {
    const theme = data.settings?.theme ?? "system";
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    root.setAttribute("lang", data.settings?.lang ?? "ru");
  }, [data.settings?.theme, data.settings?.lang]);

  const store = useMemo<Store>(() => {
    const set = (fn: (d: AppData) => AppData) => setData((d) => fn(d));
    return {
      data,
      set,
      addTask(t) {
        const task: Task = {
          id: uid(), tagIds: [], createdAt: new Date().toISOString(),
          order: Date.now(), date: null, ...t,
        } as Task;
        set((d) => ({ ...d, tasks: [...d.tasks, task] }));
        return task;
      },
      updateTask(id, patch) {
        set((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      },
      toggleTask(id) {
        set((d) => {
          const task = d.tasks.find((t) => t.id === id);
          let tasks = d.tasks.map((t) =>
            t.id === id ? { ...t, completedAt: t.completedAt ? null : new Date().toISOString() } : t
          );
          // повторяющаяся задача: при выполнении создаём следующее вхождение
          if (task && !task.completedAt && task.repeat && task.date) {
            let next: string;
            if (task.repeat === "daily") next = addDays(task.date, 1);
            else if (task.repeat === "weekly") next = addDays(task.date, 7);
            else {
              const dd = fromKey(task.date);
              next = toKey(new Date(dd.getFullYear(), dd.getMonth() + 1, dd.getDate()));
            }
            tasks = [...tasks, {
              ...task,
              id: uid(),
              date: next,
              completedAt: null,
              createdAt: new Date().toISOString(),
              order: Date.now(),
              subtasks: task.subtasks?.map((st) => ({ ...st, done: false })),
            }];
          }
          return { ...d, tasks };
        });
      },
      addGoal(g) {
        const goal: Goal = {
          id: uid(), metric: "none", startValue: 0, targetValue: 0, currentValue: 0,
          favorite: false, createdAt: new Date().toISOString(), order: Date.now(),
          startDate: todayKey(), ...g,
        } as Goal;
        set((d) => ({ ...d, goals: [...d.goals, goal] }));
        return goal;
      },
      updateGoal(id, patch) {
        set((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
      },
      deleteGoal(id) {
        set((d) => ({
          ...d,
          goals: d.goals.filter((g) => g.id !== id && g.parentId !== id),
          tasks: d.tasks.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
        }));
      },
      addHabit(h) {
        const habit: Habit = {
          id: uid(), schedule: "daily", daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          timesPerDay: 1, enterValue: false, startDate: todayKey(), showInTasks: true,
          tagIds: [], createdAt: new Date().toISOString(), order: Date.now(), ...h,
        } as Habit;
        set((d) => ({ ...d, habits: [...d.habits, habit] }));
        return habit;
      },
      updateHabit(id, patch) {
        set((d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
      },
      deleteHabit(id) {
        set((d) => ({
          ...d,
          habits: d.habits.filter((h) => h.id !== id),
          habitLogs: d.habitLogs.filter((l) => l.habitId !== id),
        }));
      },
      addArea(a) {
        const area: LifeArea = { id: uid(), icon: "heart", color: "#6e6ade", order: Date.now(), ...a } as LifeArea;
        set((d) => ({ ...d, areas: [...d.areas, area] }));
        return area;
      },
      updateArea(id, patch) {
        set((d) => ({ ...d, areas: d.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
      },
      deleteArea(id) {
        set((d) => ({
          ...d,
          areas: d.areas.filter((a) => a.id !== id),
          goals: d.goals.map((g) => (g.areaId === id ? { ...g, areaId: null } : g)),
          habits: d.habits.map((h) => (h.areaId === id ? { ...h, areaId: null } : h)),
        }));
      },
      updateTag(id, patch) {
        set((d) => ({ ...d, tags: d.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      },
      deleteTag(id) {
        set((d) => ({
          ...d,
          tags: d.tags.filter((t) => t.id !== id),
          tasks: d.tasks.map((t) => ({ ...t, tagIds: t.tagIds.filter((x) => x !== id) })),
          habits: d.habits.map((h) => ({ ...h, tagIds: h.tagIds.filter((x) => x !== id) })),
        }));
      },
      moveTaskBefore(dragId, targetId) {
        set((d) => {
          if (dragId === targetId) return d;
          const tasks = [...d.tasks];
          const from = tasks.findIndex((t) => t.id === dragId);
          if (from === -1) return d;
          const [moved] = tasks.splice(from, 1);
          const to = tasks.findIndex((t) => t.id === targetId);
          if (to === -1) return d;
          tasks.splice(to, 0, moved);
          return { ...d, tasks };
        });
      },
      addTag(name, color) {
        const tag: Tag = { id: uid(), name, color };
        set((d) => ({ ...d, tags: [...d.tags, tag] }));
        return tag;
      },
      logHabit(habitId, date, count, status, movedTo) {
        set((d) => {
          const rest = d.habitLogs.filter((l) => !(l.habitId === habitId && l.date === date));
          const logs: HabitLog[] =
            count > 0 || status
              ? [...rest, { habitId, date, count, ...(status ? { status } : {}), ...(movedTo ? { movedTo } : {}) }]
              : rest;
          return { ...d, habitLogs: logs };
        });
      },
      habitCount(habitId, date) {
        const l = data.habitLogs.find((l) => l.habitId === habitId && l.date === date);
        return l ? l.count : 0;
      },
      updateSettings(patch) {
        set((d) => ({
          ...d,
          settings: { theme: "system", lang: "ru", notifications: false, ...d.settings, ...patch },
        }));
      },
    };
  }, [data]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("no store");
  return s;
}

/** Getting-started checklist: [done, total, percent] */
export function gettingStarted(d: AppData): { done: number; total: number; pct: number } {
  const steps = [
    d.tasks.length > 0,
    d.goals.length > 0,
    d.habits.length > 0,
    d.areas.some((a) => a.vision && a.vision.length > 0),
    d.tasks.some((t) => t.completedAt),
  ];
  const done = steps.filter(Boolean).length;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100) };
}
