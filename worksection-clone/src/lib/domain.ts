import type { TaskStatus, ProjectStatus } from "@/generated/prisma/enums";

// Порядок колонок канбана
export const TASK_STATUSES: TaskStatus[] = ["IDEA", "TODO", "IN_PROGRESS", "TO_REVIEW", "DONE"];

// Метки по умолчанию (українською — мова застосунку за замовчуванням)
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  IDEA: "Ідеї",
  TODO: "Зробити",
  IN_PROGRESS: "В роботі",
  TO_REVIEW: "На перевірці",
  DONE: "Завершено",
};

// Чипы статуса (фон / текст) — палитра рестайла
export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  IDEA: "bg-[#EDE7FA] text-[#5B47A6] dark:bg-[#241d3a] dark:text-[#c3b6f0]",
  TODO: "bg-[#EEF1E7] text-[#6B7A66] dark:bg-[#1c261a] dark:text-[#a6b7a0]",
  IN_PROGRESS: "bg-[#DCEAF6] text-[#2C5E7A] dark:bg-[#132a36] dark:text-[#8fc6e2]",
  TO_REVIEW: "bg-[#FBE6D6] text-[#A0561F] dark:bg-[#33210f] dark:text-[#e2b382]",
  DONE: "bg-[#EAF4DA] text-[#3D6B26] dark:bg-[#1D2F1B] dark:text-[#A9D97F]",
};

// Цветные точки статуса
export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  IDEA: "bg-[#8E7BD6] dark:bg-[#9B87E8]",
  TODO: "bg-[#7E8C79] dark:bg-[#6E7C6A]",
  IN_PROGRESS: "bg-[#5AA9C9] dark:bg-[#5FBFA0]",
  TO_REVIEW: "bg-[#D8B25E]",
  DONE: "bg-[#C6E89B]",
};

// --- Приоритет 1..10 ---
export const PRIORITY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const DEFAULT_PRIORITY = 5;

// Тон приоритета — единый цвет для кружка-обводки (форму задаёт место использования)
export function priorityTone(p: number): string {
  if (p >= 7) return "#C25A28"; // оранжевый — высокий
  if (p >= 5) return "#3D6B26"; // зелёный — средний
  return "#94A18F";             // серый — низкий
}

// Тонированная заливка для ВЫБРАННОЙ кнопки в пикере приоритета (сетка 1..10).
// Для маленького бейджа-индикатора используйте кружок с priorityTone() (обводка + прозрачный фон).
export function priorityStyle(p: number): string {
  if (p >= 7) return "bg-[#FBE6D6] text-[#A0561F] border-[#E8B892] dark:bg-[#33210f] dark:text-[#e2b382] dark:border-[#5a3a1e]";
  if (p >= 5) return "bg-[#EAF4DA] text-[#3D6B26] border-[#BFE0A0] dark:bg-[#1D2F1B] dark:text-[#A9D97F] dark:border-[#2f4a2a]";
  return "bg-[#EEF1E7] text-[#6B7A66] border-[#D6DDCD] dark:bg-[#1c261a] dark:text-[#a6b7a0] dark:border-[#2a352626]";
}

export function priorityChipStyle(p: number): string {
  if (p >= 7) return "bg-[#FBE6D6] text-[#A0561F] dark:bg-[#33210f] dark:text-[#e2b382]";
  if (p >= 5) return "bg-[#EAF4DA] text-[#3D6B26] dark:bg-[#1D2F1B] dark:text-[#A9D97F]";
  return "bg-[#EEF1E7] text-[#6B7A66] dark:bg-[#1c261a] dark:text-[#a6b7a0]";
}

// --- Пресеты плановой длительности (минуты) ---
export const PLANNED_MINUTES = [15, 30, 60, 120, 180] as const;
const PLANNED_UNITS: Record<string, { h: string; m: string }> = {
  uk: { h: "год", m: "хв" },
  ru: { h: "ч", m: "м" },
  en: { h: "h", m: "m" },
};
export function plannedLabel(min: number, locale = "uk"): string {
  const u = PLANNED_UNITS[locale] ?? PLANNED_UNITS.uk;
  if (min < 60) return `${min}${u.m}`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h}${u.h}` : `${(min / 60).toFixed(1)}${u.h}`;
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
  ACTIVE: "bg-[#EAF4DA] text-[#3D6B26] dark:bg-[#1D2F1B] dark:text-[#A9D97F]",
  ON_HOLD: "bg-[#FBE6D6] text-[#A0561F] dark:bg-[#33210f] dark:text-[#e2b382]",
  DONE: "bg-[#DCEAF6] text-[#2C5E7A] dark:bg-[#132a36] dark:text-[#8fc6e2]",
  ARCHIVED: "bg-[#EEF1E7] text-[#6B7A66] dark:bg-[#1c261a] dark:text-[#a6b7a0]",
};
