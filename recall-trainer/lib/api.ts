// Тонкий клиент над route handlers. Используется в client-компонентах.

async function req<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Ошибка ${res.status}`);
  return data as T;
}

export const api = {
  createSource: (b: { kind: string; url?: string; title?: string; text?: string; type?: string }) =>
    req<{ sourceId: string; draftId?: string; needTranscript?: boolean; error?: string }>(
      "/api/sources",
      "POST",
      b
    ),
  updateSource: (id: string, b: { rawContent?: string; title?: string }) =>
    req<{ id: string }>(`/api/sources/${id}`, "PATCH", b),
  deleteSource: (id: string) => req(`/api/sources/${id}`, "DELETE"),
  reprocess: (id: string) =>
    req<{ draftId?: string; needTranscript?: boolean; error?: string }>(
      `/api/sources/${id}/reprocess`,
      "POST"
    ),

  getDraft: (id: string) => req<import("./types").DraftDTO>(`/api/drafts/${id}`, "GET"),
  patchBlock: (id: string, b: Record<string, unknown>) => req(`/api/blocks/${id}`, "PATCH", b),
  deleteBlock: (id: string) => req(`/api/blocks/${id}`, "DELETE"),
  splitBlock: (id: string, keyPointIndex?: number) =>
    req<{ newBlockId: string }>(`/api/blocks/${id}/split`, "POST", { keyPointIndex }),
  mergeBlock: (id: string) => req(`/api/blocks/${id}/merge`, "POST"),
  reorder: (draftId: string, orderedIds: string[]) =>
    req(`/api/drafts/${draftId}/reorder`, "POST", { orderedIds }),
  publish: (draftId: string) =>
    req<{ count: number; ids: string[] }>(`/api/drafts/${draftId}/publish`, "POST"),

  quick: (action: string, text: string) =>
    req<{ result: string }>("/api/ai/quick", "POST", { action, text }),
  suggestMeta: (title: string, content: string) =>
    req<{ title: string; topic: string; tags: string[] }>("/api/ai/suggest-meta", "POST", {
      title,
      content,
    }),

  createKnowledge: (b: Record<string, unknown>) =>
    req<{ id: string }>("/api/knowledge", "POST", b),
  patchKnowledge: (id: string, b: Record<string, unknown>) =>
    req(`/api/knowledge/${id}`, "PATCH", b),
  deleteKnowledge: (id: string) => req(`/api/knowledge/${id}`, "DELETE"),
  checkDuplicate: (b: { title?: string; content?: string; excludeId?: string }) =>
    req<{ candidates: { id: string; title: string; similarity: number }[] }>(
      "/api/knowledge/check-duplicate",
      "POST",
      b
    ),
  makeCard: (id: string, b?: { question?: string; answer?: string }) =>
    req<{ cardId: string; question: string; answer: string }>(
      `/api/knowledge/${id}/card`,
      "POST",
      b ?? {}
    ),
  deleteCard: (id: string) => req(`/api/knowledge/${id}/card`, "DELETE"),
  link: (id: string, toId: string) => req(`/api/knowledge/${id}/link`, "POST", { toId }),
  unlink: (id: string, toId: string) => req(`/api/knowledge/${id}/link`, "DELETE", { toId }),

  createTopic: (b: { name: string; parentId?: string | null }) =>
    req<{ id: string }>("/api/topics", "POST", b),
  renameTopic: (id: string, name: string) => req(`/api/topics/${id}`, "PATCH", { name }),
  deleteTopic: (id: string) => req(`/api/topics/${id}`, "DELETE"),

  search: (query: string, mode?: string) =>
    req<{ hits: import("./types").SearchHit[] }>("/api/search", "POST", { query, mode }),
  ask: (question: string, allowExternal: boolean, topicId?: string) =>
    req<{ answer: string; contexts: { id: string; title: string; source: string | null }[] }>(
      "/api/ask",
      "POST",
      { question, allowExternal, topicId }
    ),
  quiz: (topicId: string) =>
    req<{ questions: { id: string | null; question: string }[]; message?: string }>(
      "/api/quiz",
      "POST",
      { topicId }
    ),
  gradeQuiz: (b: { question: string; knowledgeId: string | null; answer: string }) =>
    req<{ verdict: string; feedback: string }>("/api/quiz/grade", "POST", b),
  review: (cardId: string, rating: string) =>
    req<{ dueAt: string; progress: number; known: boolean }>("/api/review", "POST", {
      cardId,
      rating,
    }),
};
