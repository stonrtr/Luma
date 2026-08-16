"use client";
import { createContext, useContext } from "react";
import type { Knowledge, UserSettings } from "@/lib/types";

export type StudyScope = {
  scope: "today" | "all" | "collection";
  collectionId?: string;
  title?: string;
  cards?: Knowledge[]; // preloaded queue (e.g. reviewing a single topic); skips fetch
};

export type AppCtx = {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  refreshKey: number;
  refresh: () => void;
  startStudy: (s: StudyScope) => void;
  goTo: (id: SectionId) => void;
};

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppShell");
  return ctx;
}

export const SECTIONS = [
  { id: "today", label: "Сегодня", icon: "☀️" },
  { id: "knowledge", label: "Мои темы", icon: "📚" },
  { id: "progress", label: "Прогресс", icon: "📈" },
  { id: "settings", label: "Настройки", icon: "⚙️" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
