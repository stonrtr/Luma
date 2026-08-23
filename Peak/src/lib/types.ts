export type ID = string;

export type Impact = "Low" | "Medium" | "High";
export type Priority = "Low" | "Medium" | "High";

export interface LifeArea {
  id: ID;
  name: string;
  icon: string; // key into AREA_ICONS
  color: string;
  vision?: string;
  favorite?: boolean;
  archived?: boolean;
  order: number;
}

export type Metric = "numeric" | "tasks" | "none";

export interface Goal {
  id: ID;
  name: string;
  description?: string;
  areaId?: ID | null;
  parentId?: ID | null; // subgoal when set
  impact?: Impact | null;
  startDate?: string | null; // YYYY-MM-DD
  deadline?: string | null;
  metric: Metric;
  startValue: number;
  targetValue: number;
  currentValue: number;
  label?: string;
  progressLog?: { date: string; value: number }[];
  color?: string | null; // null => same as life area
  favorite: boolean;
  icon?: string;
  completedAt?: string | null;
  showRoadmap?: boolean; // default true
  archived?: boolean;
  createdAt: string;
  order: number;
}

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

export type Repeat = "daily" | "weekly" | "monthly";

export interface Task {
  id: ID;
  title: string;
  notes?: string;
  subtasks?: Subtask[];
  repeat?: Repeat | null;
  reminder?: boolean;
  date?: string | null; // YYYY-MM-DD
  timeStart?: string | null; // HH:MM
  timeEnd?: string | null;
  duration?: number | null; // minutes
  deadline?: string | null;
  priority?: Priority | null;
  tagIds: ID[];
  goalId?: ID | null;
  areaId?: ID | null;
  habitId?: ID | null;
  completedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  order: number;
}

export type Schedule = "daily" | "custom";

export interface Habit {
  id: ID;
  name: string;
  notes?: string;
  subtasks?: Subtask[];
  icon?: string;
  showInHabits?: boolean; // default true
  archived?: boolean;
  schedule: Schedule;
  daysOfWeek: number[]; // 0=Mon..6=Sun, used when schedule=custom
  timesPerDay: number;
  enterValue: boolean;
  startDate: string;
  endDate?: string | null;
  time?: string | null;
  goalId?: ID | null;
  areaId?: ID | null;
  priority?: Priority | null;
  tagIds: ID[];
  reminder?: string | null;
  showInTasks: boolean;
  createdAt: string;
  order: number;
}

export type HabitDayStatus = "skipped" | "failed" | "moved";

export interface HabitLog {
  habitId: ID;
  date: string; // YYYY-MM-DD
  count: number;
  status?: HabitDayStatus | null;
  movedTo?: string | null;
}

export interface Tag {
  id: ID;
  name: string;
  color: string;
}

export interface CalEvent {
  id: ID;
  title: string;
  date: string; // YYYY-MM-DD
  timeStart?: string | null;
  timeEnd?: string | null;
}

export interface AppData {
  calendarEvents?: CalEvent[];
  areas: LifeArea[];
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  tags: Tag[];
  gettingStartedCollapsed: boolean;
  gettingStartedDismissed: boolean;
}

export type View =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "all" }
  | { kind: "completed" }
  | { kind: "trash" }
  | { kind: "areas" }
  | { kind: "area"; id: ID; tab?: string }
  | { kind: "goals" }
  | { kind: "goal"; id: ID; tab?: string }
  | { kind: "habits" }
  | { kind: "insights" }
  | { kind: "tag"; id: ID };
