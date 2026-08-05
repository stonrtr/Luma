import type { TaskStatus, ProjectStatus } from "@/generated/prisma/enums";

// Порядок колонок канбана
export const TASK_STATUSES: TaskStatus[] = ["IDEA", "TODO", "IN_PROGRESS", "TO_REVIEW", "DONE"];

// Метки по умолчанию (українською — мова застосунку за замовчуванням)
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  IDEA: "Ідея",
  TODO: "Зробити",
  IN_PROGRESS: "В роботі",
  TO_REVIEW: "На перевірці",
  DONE: "Завершено",
};

export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  IDEA: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  TODO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  TO_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  IDEA: "bg-purple-500",
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500",
  TO_REVIEW: "bg-amber-500",
  DONE: "bg-emerald-500",
};

// --- Приоритет 1..10 ---
export const PRIORITY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const DEFAULT_PRIORITY = 5;

export function priorityStyle(p: number): string {
  if (p >= 9) return "bg-red-600 text-white";
  if (p >= 7) return "bg-orange-500 text-white";
  if (p >= 5) return "bg-sky-500 text-white";
  if (p >= 3) return "bg-slate-400 text-white";
  return "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
}

export function priorityChipStyle(p: number): string {
  if (p >= 9) return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (p >= 7) return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
  if (p >= 5) return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

// --- Пресеты плановой длительности (минуты) ---
export const PLANNED_MINUTES = [15, 30, 60, 120, 180] as const;
export function plannedLabel(min: number): string {
  if (min < 60) return `${min}хв`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h}год` : `${(min / 60).toFixed(1)}год`;
}

// Статусы задачи для создания (идея/зробити)
export const CREATE_STATUSES: TaskStatus[] = ["IDEA", "TODO"];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "Активний",
  ON_HOLD: "На паузі",
  DONE: "Завершений",
  ARCHIVED: "В архіві",
};

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ON_HOLD: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DONE: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ARCHIVED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
