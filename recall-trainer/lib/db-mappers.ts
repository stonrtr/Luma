// Мапперы Prisma-строк → DTO (§типы в lib/types). JSON-поля парсятся здесь.
import type {
  SourceDTO,
  SourceType,
  SourceStatus,
  DraftBlockDTO,
  KnowledgeDTO,
  TopicDTO,
  CardDTO,
  TranscriptSegment,
} from "./types";

export function jsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function jsonSegments(raw: string | null | undefined): TranscriptSegment[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((s) => s && typeof s.text === "string")
      .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text) }));
  } catch {
    return [];
  }
}

type TopicLike = { id: string; name: string; parentId: string | null; parent?: TopicLike | null } | null;

export function topicPath(topic: TopicLike): string | null {
  if (!topic) return null;
  const parts: string[] = [];
  let t: TopicLike = topic;
  let guard = 0;
  while (t && guard++ < 8) {
    parts.unshift(t.name);
    t = t.parent ?? null;
  }
  return parts.join(" → ");
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapSource(s: any): SourceDTO {
  return {
    id: s.id,
    type: s.type as SourceType,
    title: s.title,
    author: s.author ?? null,
    url: s.url ?? null,
    thumbnail: s.thumbnail ?? null,
    duration: s.duration ?? null,
    publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
    language: s.language,
    status: s.status as SourceStatus,
    error: s.error ?? null,
    hasRaw: !!s.rawContent,
    segments: jsonSegments(s.segments),
    rawContent: s.rawContent ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    draftId: s.drafts?.[0]?.id ?? s.draftId ?? null,
    knowledgeCount: s._count?.knowledge ?? 0,
  };
}

export function mapBlock(b: any): DraftBlockDTO {
  return {
    id: b.id,
    title: b.title,
    summary: b.summary,
    content: b.content,
    keyPoints: jsonArray(b.keyPoints),
    terms: jsonArray(b.terms),
    examples: jsonArray(b.examples),
    takeaways: jsonArray(b.takeaways),
    startTimestamp: b.startTimestamp ?? null,
    endTimestamp: b.endTimestamp ?? null,
    selected: b.selected,
    order: b.order,
    topicId: b.topicId ?? null,
    suggestedTopic: b.suggestedTopic ?? null,
    userEdited: b.userEdited,
  };
}

export function mapKnowledge(k: any): KnowledgeDTO {
  return {
    id: k.id,
    title: k.title,
    content: k.content,
    keyPoints: jsonArray(k.keyPoints),
    topicId: k.topicId ?? null,
    topicPath: topicPath(k.topic ?? null),
    sourceId: k.sourceId ?? null,
    sourceTitle: k.source?.title ?? null,
    sourceType: (k.source?.type as SourceType) ?? null,
    sourceUrl: k.source?.url ?? null,
    sourceStart: k.sourceStart ?? null,
    sourceEnd: k.sourceEnd ?? null,
    tags: jsonArray(k.tags),
    personalComment: k.personalComment,
    importance: k.importance,
    favorite: k.favorite,
    hasCard: !!k.card,
    cardDue: k.card?.dueAt ? k.card.dueAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
    lastReviewedAt: k.lastReviewedAt ? k.lastReviewedAt.toISOString() : null,
    related: k.linksFrom
      ? k.linksFrom.map((l: any) => ({ id: l.to.id, title: l.to.title }))
      : undefined,
  };
}

export function mapTopic(t: any): TopicDTO {
  return {
    id: t.id,
    name: t.name,
    parentId: t.parentId ?? null,
    position: t.position,
    knowledgeCount: t._count?.knowledge ?? 0,
    children: t.children ? t.children.map(mapTopic) : undefined,
  };
}

export function mapCard(c: any): CardDTO {
  return {
    id: c.id,
    knowledgeId: c.knowledgeId,
    knowledgeTitle: c.knowledge?.title ?? "",
    question: c.question,
    answer: c.answer,
    progress: c.progress,
    dueAt: c.dueAt ? c.dueAt.toISOString() : null,
  };
}
