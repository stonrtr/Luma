import type { TaskStatus, TaskPriority, ProjectStatus } from "@/generated/prisma/enums";

export const TASK_STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "TO_REVIEW",
  "DONE",
  "PAUSED",
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  TO_REVIEW: "На проверке",
  DONE: "Готово",
  PAUSED: "Пауза",
};

// tailwind-классы для колонок/бейджей статусов
export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  TODO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  TO_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  PAUSED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500",
  TO_REVIEW: "bg-amber-500",
  DONE: "bg-emerald-500",
  PAUSED: "bg-zinc-400",
};

export const TASK_PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH", "CRITICAL"];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Низкий",
  NORMAL: "Обычный",
  HIGH: "Высокий",
  CRITICAL: "Критичный",
};

export const TASK_PRIORITY_STYLE: Record<TaskPriority, string> = {
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  NORMAL: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "Активен",
  ON_HOLD: "На паузе",
  DONE: "Завершён",
  ARCHIVED: "В архиве",
};

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ON_HOLD: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DONE: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ARCHIVED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
