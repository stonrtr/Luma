// Доменная модель. Все id — строки (UUID), даты — 'YYYY-MM-DD',
// таймстемпы — ISO-строки. Спроектировано под будущую синхронизацию:
// стабильные id и updated_at, без опоры на автоинкремент.

export type GoalType = "achievement" | "maintenance";
export type GoalStatus = "active" | "done" | "archived";

export type ScheduleType = "daily" | "weekly" | "weekdays";

export interface Schedule {
  type: ScheduleType;
  timesPerWeek?: number; // для 'weekly'
  days?: number[]; // для 'weekdays', ISO 1..7 (Пн..Вс)
}

export interface Direction {
  id: string;
  name: string;
  ord: number;
  archived: boolean;
  createdAt: string;
}

export interface Goal {
  id: string;
  directionId: string | null; // легаси: слой направлений убран из UI
  name: string;
  type: GoalType;
  ord: number;
  status: GoalStatus;
  createdAt: string;
}

export interface Task {
  id: string;
  goalId: string | null; // null = инбокс (задача без цели)
  title: string;
  dueDate: string | null;
  doneAt: string | null;
  ord: number;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  goalId: string | null; // привычка принадлежит цели
  directionId: string | null; // легаси
  name: string;
  schedule: Schedule;
  archived: boolean;
  ord: number;
  createdAt: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  date: string;
  done: boolean;
  updatedAt: string;
}

export interface AppState {
  directions: Direction[];
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  entries: HabitEntry[];
  today: string; // серверное «сегодня», чтобы клиент и БД совпадали
}
