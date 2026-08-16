"use client";
import { createContext, useContext } from "react";
import type { UserSettings } from "@/lib/types";

export type StudyScope = {
  scope: "today" | "lesson" | "favorites" | "random";
  lessonId?: string;
  title?: string;
};

export type AppCtx = {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  refreshKey: number;
  refresh: () => void;
  startStudy: (s: StudyScope) => void;
  goTo: (id: SectionId) => void;
  ttsAvailable: boolean;
  /** Открыт ли полноэкранный оверлей сессии (встроенная карточка в «Сегодня» приостанавливает хоткеи). */
  studyOpen: boolean;
};

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppShell");
  return ctx;
}

export const SECTIONS = [
  { id: "today", label: "Сегодня", icon: "☀️" },
  { id: "lessons", label: "Уроки", icon: "📚" },
  { id: "phrases", label: "Фразы", icon: "🗂️" },
  { id: "progress", label: "Прогресс", icon: "📈" },
  { id: "settings", label: "Настройки", icon: "⚙️" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
