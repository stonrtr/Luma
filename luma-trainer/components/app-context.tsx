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
  { id: "rules", label: "Правила", icon: "📐" },
  { id: "progress", label: "Прогресс", icon: "📈" },
  { id: "settings", label: "Настройки", icon: "⚙️" },
] as const;

export const HUES = ["blue", "green", "purple", "red"] as const;
export const HUE_DOTS: Record<(typeof HUES)[number], string> = {
  blue: "#2f6fe0",
  green: "#27a35c",
  purple: "#7e46d8",
  red: "#d64c4c",
};

export type SectionId = (typeof SECTIONS)[number]["id"];
