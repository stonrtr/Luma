// Tiny typed fetch helpers for the client.
import type { Collection, Knowledge, ProgressData, UserSettings } from "./types";

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

  collections: () => api.get<Collection[]>("/api/collections"),
  createCollection: (name: string) => api.post<Collection>("/api/collections", { name }),
  renameCollection: (id: string, name: string) =>
    api.patch<Collection>(`/api/collections/${id}`, { name }),
  deleteCollection: (id: string) => api.del(`/api/collections/${id}`),

  knowledge: (q: string) => api.get<Knowledge[]>(`/api/knowledge?${q}`),
  createKnowledge: (b: { sourceText: string; title?: string; collectionId?: string | null }) =>
    api.post<Knowledge>("/api/knowledge", b),
  getKnowledge: (id: string) => api.get<Knowledge>(`/api/knowledge/${id}`),
  updateKnowledge: (id: string, b: Record<string, unknown>) =>
    api.patch<Knowledge>(`/api/knowledge/${id}`, b),
  deleteKnowledge: (id: string) => api.del(`/api/knowledge/${id}`),
  regenerate: (id: string) => api.post<Knowledge>(`/api/knowledge/${id}/regenerate`),

  study: (scope: string, collectionId?: string) =>
    api.get<{ scope: string; cards: Knowledge[] }>(
      `/api/study?scope=${scope}${collectionId ? `&collectionId=${collectionId}` : ""}`
    ),
  review: (knowledgeId: string, rating: string, usedHint: boolean) =>
    api.post<{ card: Knowledge; intervalDays: number }>("/api/review", {
      knowledgeId,
      rating,
      usedHint,
    }),

  progress: () => api.get<ProgressData>("/api/progress"),
};
