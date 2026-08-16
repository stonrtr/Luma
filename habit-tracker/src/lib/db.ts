import Database from "better-sqlite3";
import path from "path";
import { randomUUID } from "crypto";
import type { AppState, Direction, Goal, Habit, HabitEntry, Task, Schedule } from "./types";
import { todayStr, addDays, isoWeekday } from "./date";

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const file = path.join(process.cwd(), "data.db");
  _db = new Database(file);
  _db.pragma("journal_mode = WAL");
  init(_db);
  return _db;
}

function init(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS direction (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ord INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS goal (
      id TEXT PRIMARY KEY,
      direction_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      ord INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task (
      id TEXT PRIMARY KEY,
      goal_id TEXT,
      title TEXT NOT NULL,
      due_date TEXT,
      done_at TEXT,
      ord INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS habit (
      id TEXT PRIMARY KEY,
      goal_id TEXT,
      direction_id TEXT,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      ord INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS habit_entry (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE (habit_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_entry_habit ON habit_entry(habit_id, date);
    CREATE INDEX IF NOT EXISTS idx_task_due ON task(due_date);
  `);
  const n = (d.prepare("SELECT COUNT(*) c FROM goal").get() as { c: number }).c;
  if (n === 0) seed(d);
}

// ---------- snapshot ----------

export function getState(): AppState {
  const d = db();
  const directions = (d.prepare("SELECT * FROM direction WHERE archived=0 ORDER BY ord, created_at").all() as RowDir[]).map(mapDir);
  const goals = (d.prepare("SELECT * FROM goal WHERE status!='archived' ORDER BY ord, created_at").all() as RowGoal[]).map(mapGoal);
  const tasks = (d.prepare("SELECT * FROM task ORDER BY ord, created_at").all() as RowTask[]).map(mapTask);
  const habits = (d.prepare("SELECT * FROM habit WHERE archived=0 ORDER BY ord, created_at").all() as RowHabit[]).map(mapHabit);
  const entries = (d.prepare("SELECT * FROM habit_entry").all() as RowEntry[]).map(mapEntry);
  return { directions, goals, tasks, habits, entries, today: todayStr() };
}

// ---------- mutations ----------

export type Mutation =
  | { action: "addGoal"; id: string; name: string; type: "achievement" | "maintenance" }
  | { action: "renameGoal"; id: string; name: string }
  | { action: "setGoalStatus"; id: string; status: "active" | "done" | "archived" }
  | { action: "addTask"; id: string; goalId: string | null; title: string; dueDate: string | null }
  | { action: "toggleTask"; id: string; done: boolean }
  | { action: "setTaskDue"; id: string; dueDate: string | null }
  | { action: "deleteTask"; id: string }
  | { action: "addHabit"; id: string; goalId: string | null; name: string; schedule: Schedule }
  | { action: "archiveHabit"; id: string }
  | { action: "toggleHabitEntry"; id: string; habitId: string; date: string };

export function applyMutation(m: Mutation): void {
  const d = db();
  const now = new Date().toISOString();
  switch (m.action) {
    case "addGoal": {
      const ord = nextOrd(d, "goal");
      d.prepare("INSERT INTO goal (id,direction_id,name,type,ord,status,created_at) VALUES (?,NULL,?,?,?, 'active', ?)").run(
        m.id, m.name, m.type, ord, now,
      );
      break;
    }
    case "renameGoal":
      d.prepare("UPDATE goal SET name=? WHERE id=?").run(m.name, m.id);
      break;
    case "setGoalStatus":
      d.prepare("UPDATE goal SET status=? WHERE id=?").run(m.status, m.id);
      break;
    case "addTask": {
      const ord = nextOrd(d, "task");
      d.prepare("INSERT INTO task (id,goal_id,title,due_date,done_at,ord,created_at,updated_at) VALUES (?,?,?,?,NULL,?,?,?)").run(
        m.id, m.goalId, m.title, m.dueDate, ord, now, now,
      );
      break;
    }
    case "toggleTask":
      d.prepare("UPDATE task SET done_at=?, updated_at=? WHERE id=?").run(m.done ? now : null, now, m.id);
      break;
    case "setTaskDue":
      d.prepare("UPDATE task SET due_date=?, updated_at=? WHERE id=?").run(m.dueDate, now, m.id);
      break;
    case "deleteTask":
      d.prepare("DELETE FROM task WHERE id=?").run(m.id);
      break;
    case "addHabit": {
      const ord = nextOrd(d, "habit");
      d.prepare("INSERT INTO habit (id,goal_id,direction_id,name,schedule,archived,ord,created_at) VALUES (?,?,NULL,?,?,0,?,?)").run(
        m.id, m.goalId, m.name, JSON.stringify(m.schedule), ord, now,
      );
      break;
    }
    case "archiveHabit":
      d.prepare("UPDATE habit SET archived=1 WHERE id=?").run(m.id);
      break;
    case "toggleHabitEntry": {
      // Записи на будущее запрещены на уровне данных.
      if (m.date > todayStr()) return;
      const row = d.prepare("SELECT id, done FROM habit_entry WHERE habit_id=? AND date=?").get(m.habitId, m.date) as
        | { id: string; done: number }
        | undefined;
      if (row) {
        d.prepare("UPDATE habit_entry SET done=?, updated_at=? WHERE id=?").run(row.done ? 0 : 1, now, row.id);
      } else {
        d.prepare("INSERT INTO habit_entry (id,habit_id,date,done,updated_at) VALUES (?,?,?,1,?)").run(m.id, m.habitId, m.date, now);
      }
      break;
    }
  }
}

function nextOrd(d: Database.Database, table: string, col?: string, val?: string): number {
  const q = col
    ? `SELECT COALESCE(MAX(ord),-1)+1 v FROM ${table} WHERE ${col}=?`
    : `SELECT COALESCE(MAX(ord),-1)+1 v FROM ${table}`;
  const stmt = d.prepare(q);
  return (col ? (stmt.get(val) as { v: number }) : (stmt.get() as { v: number })).v;
}

// ---------- row mappers ----------

type RowDir = { id: string; name: string; ord: number; archived: number; created_at: string };
type RowGoal = { id: string; direction_id: string | null; name: string; type: string; ord: number; status: string; created_at: string };
type RowTask = { id: string; goal_id: string | null; title: string; due_date: string | null; done_at: string | null; ord: number; created_at: string; updated_at: string };
type RowHabit = { id: string; goal_id: string | null; direction_id: string | null; name: string; schedule: string; archived: number; ord: number; created_at: string };
type RowEntry = { id: string; habit_id: string; date: string; done: number; updated_at: string };

const mapDir = (r: RowDir): Direction => ({ id: r.id, name: r.name, ord: r.ord, archived: !!r.archived, createdAt: r.created_at });
const mapGoal = (r: RowGoal): Goal => ({ id: r.id, directionId: r.direction_id, name: r.name, type: r.type as Goal["type"], ord: r.ord, status: r.status as Goal["status"], createdAt: r.created_at });
const mapTask = (r: RowTask): Task => ({ id: r.id, goalId: r.goal_id, title: r.title, dueDate: r.due_date, doneAt: r.done_at, ord: r.ord, createdAt: r.created_at, updatedAt: r.updated_at });
const mapHabit = (r: RowHabit): Habit => ({ id: r.id, goalId: r.goal_id, directionId: r.direction_id, name: r.name, schedule: JSON.parse(r.schedule), archived: !!r.archived, ord: r.ord, createdAt: r.created_at });
const mapEntry = (r: RowEntry): HabitEntry => ({ id: r.id, habitId: r.habit_id, date: r.date, done: !!r.done, updatedAt: r.updated_at });

// ---------- seed ----------

function seed(d: Database.Database) {
  const today = todayStr();
  const created = new Date(new Date(today + "T09:00:00").getTime() - 34 * 86400000).toISOString();
  const now = new Date().toISOString();

  const goal = (name: string, type: string, ord: number) => {
    const id = randomUUID();
    d.prepare("INSERT INTO goal (id,direction_id,name,type,ord,status,created_at) VALUES (?,NULL,?,?,?, 'active', ?)").run(id, name, type, ord, created);
    return id;
  };
  const task = (goalId: string | null, title: string, dueOffset: number | null, done: boolean, ord: number) => {
    const id = randomUUID();
    const due = dueOffset === null ? null : addDays(today, dueOffset);
    d.prepare("INSERT INTO task (id,goal_id,title,due_date,done_at,ord,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(
      id, goalId, title, due, done ? now : null, ord, created, now,
    );
    return id;
  };
  const habit = (goalId: string | null, name: string, schedule: Schedule, pattern: number[], ord: number) => {
    const id = randomUUID();
    d.prepare("INSERT INTO habit (id,goal_id,direction_id,name,schedule,archived,ord,created_at) VALUES (?,?,NULL,?,?,0,?,?)").run(
      id, goalId, name, JSON.stringify(schedule), ord, created,
    );
    // отметки за прошедшие 30 дней по циклическому паттерну (пропускаем незапланированные дни)
    for (let off = 30; off >= 1; off--) {
      const date = addDays(today, -off);
      const isSched = schedule.type === "weekdays" ? (schedule.days ?? []).includes(isoWeekday(date)) : true;
      if (!isSched) continue;
      const done = pattern[off % pattern.length] === 1;
      if (done) {
        d.prepare("INSERT INTO habit_entry (id,habit_id,date,done,updated_at) VALUES (?,?,?,1,?)").run(randomUUID(), id, date, now);
      }
    }
    return id;
  };

  const gWeight = goal("Набрать 5 кг", "achievement", 0);
  task(gWeight, "Тренировка", 0, false, 0);
  task(gWeight, "Закупить продукты", 2, false, 1);
  task(gWeight, "Записаться к тренеру", 4, false, 2);
  task(gWeight, "Замеры и взвешивание", 12, false, 3);
  task(gWeight, "План питания", -3, true, 4);
  task(gWeight, "Купить абонемент", -5, true, 5);
  habit(gWeight, "Силовая тренировка", { type: "weekdays", days: [1, 3, 5] }, [1, 1, 0, 1, 1, 1, 0], 0);
  habit(gWeight, "150 г белка", { type: "daily" }, [1, 1, 1, 0, 1, 0, 1], 1);

  const gSleep = goal("Режим сна", "maintenance", 1);
  habit(gSleep, "Отбой до 23:30", { type: "daily" }, [1, 0, 1, 1, 0, 0, 1], 2);

  const gEng = goal("Английский B2", "achievement", 2);
  task(gEng, "Урок английского", 0, false, 0);
  task(gEng, "Домашнее задание", 1, false, 1);
  task(gEng, "Оплатить месяц", 3, false, 2);
  task(gEng, "Сдать пробный экзамен", 40, false, 3);
  task(gEng, "Пробный тест", -2, true, 4);
  habit(gEng, "20 минут чтения", { type: "daily" }, [1, 1, 1, 1, 1, 1, 0], 3);
  habit(gEng, "Anki-карточки", { type: "weekly", timesPerWeek: 5 }, [1, 1, 0, 1, 0, 1, 1], 4);

  const gBudget = goal("Учёт расходов", "maintenance", 3);
  task(gBudget, "Внести расходы за неделю", 0, false, 0);
  habit(gBudget, "Записать траты дня", { type: "daily" }, [1, 0, 1, 1, 0, 1, 1], 5);

  // инбокс-задача без цели
  task(null, "Забрать посылку", 0, false, 6);
}
