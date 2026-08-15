// Tiny typed fetch helpers for the client.
import type {
  GrammarRule,
  Lesson,
  PhraseCard,
  Topic,
  TranslationResult,
  UserSettings,
} from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.error || j.message || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => req<T>(url),
  post: <T>(url: string, body?: unknown) =>
    req<T>(url, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(url: string, body?: unknown) =>
    req<T>(url, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: <T>(url: string) => req<T>(url, { method: "DELETE" }),
};

export const A = {
  settings: () => api.get<UserSettings>("/api/settings"),
  saveSettings: (b: Partial<UserSettings>) => api.patch<UserSettings>("/api/settings", b),
  topics: () => api.get<Topic[]>("/api/topics"),
  createTopic: (name: string) => api.post<Topic>("/api/topics", { name }),
  renameTopic: (id: string, name: string) => api.patch<Topic>(`/api/topics/${id}`, { name }),
  deleteTopic: (id: string) => api.del(`/api/topics/${id}`),
  lessons: (archived = false, sort = "recent") =>
    api.get<Lesson[]>(`/api/lessons?archived=${archived}&sort=${sort}`),
  createLesson: (b: { title: string; topicId?: string; newTopicName?: string }) =>
    api.post<Lesson>("/api/lessons", b),
  lesson: (id: string) => api.get<{ lesson: Lesson; phrases: PhraseCard[] }>(`/api/lessons/${id}`),
  updateLesson: (id: string, b: Record<string, unknown>) => api.patch<Lesson>(`/api/lessons/${id}`, b),
  deleteLesson: (id: string) => api.del(`/api/lessons/${id}`),
  retranslateLesson: (id: string) => api.post(`/api/lessons/${id}/retranslate`),
  phrases: (q: string) => api.get<PhraseCard[]>(`/api/phrases?${q}`),
  createPhrase: (b: Record<string, unknown>) => api.post<PhraseCard>("/api/phrases", b),
  updatePhrase: (id: string, b: Record<string, unknown>) =>
    api.patch<PhraseCard>(`/api/phrases/${id}`, b),
  deletePhrase: (id: string) => api.del(`/api/phrases/${id}`),
  translatePreview: (b: { text?: string; english?: string; russian?: string }) =>
    api.post<TranslationResult & { error?: string; message?: string }>("/api/translate", b),
  runTranslations: () => api.post<{ translated: number }>("/api/translate/run"),
  import: (b: Record<string, unknown>) =>
    api.post<{ lessonId: string; saved: number; translated: number; pending: number; errors: number }>(
      "/api/import",
      b
    ),
  study: (scope: string, lessonId?: string) =>
    api.get<{ scope: string; cards: PhraseCard[] }>(
      `/api/study?scope=${scope}${lessonId ? `&lessonId=${lessonId}` : ""}`
    ),
  review: (cardId: string, rating: string, usedHint: boolean) =>
    api.post<{ card: PhraseCard; intervalDays: number }>("/api/review", { cardId, rating, usedHint }),
  rules: (archived = false) => api.get<GrammarRule[]>(`/api/rules?archived=${archived}`),
  createRule: (query: string) => api.post<GrammarRule>("/api/rules", { query }),
  rule: (id: string) => api.get<GrammarRule>(`/api/rules/${id}`),
  updateRule: (id: string, b: Record<string, unknown>) => api.patch<GrammarRule>(`/api/rules/${id}`, b),
  deleteRule: (id: string) => api.del(`/api/rules/${id}`),
  reviewRule: (id: string, rating: string) =>
    api.post<{ rule: GrammarRule }>(`/api/rules/${id}/review`, { rating }),
  progress: () => api.get<ProgressData>("/api/progress"),
  ttsInfo: () => api.get<{ available: boolean; voices: { id: string; label: string }[] }>("/api/tts"),
};

export type ProgressData = {
  reviewedToday: number;
  newToday: number;
  learnedToday: number;
  learnedWeek: number;
  learnedMonth: number;
  activePhrases: number;
  attention: number;
  totalPhrases: number;
  learnedTotal: number;
  distribution: number[];
  activity7: { date: string; reviewed: number; newStudied: number }[];
};
