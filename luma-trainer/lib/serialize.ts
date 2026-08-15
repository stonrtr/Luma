// Map Prisma rows (with JSON-string columns) to the serialized domain types.
import type {
  GrammarRule,
  Lesson,
  LessonStats,
  PhraseCard,
  RuleExercise,
  Topic,
  UserSettings,
} from "./types";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

// Loose row types — we only read fields we map.
/* eslint-disable @typescript-eslint/no-explicit-any */

export function toPhrase(row: any, lessonTitle?: string): PhraseCard {
  return {
    id: row.id,
    lessonId: row.lessonId,
    lessonTitle: lessonTitle ?? row.lesson?.title,
    english: row.english,
    russian: row.russian,
    alternativeTranslations: parseJson<string[]>(row.alternativeTranslations, []),
    transcription: row.transcription,
    exampleEn: row.exampleEn,
    exampleRu: row.exampleRu,
    difficulty: row.difficulty,
    favorite: row.favorite,
    progress: row.progress,
    known: row.known,
    stability: row.stability,
    retrievability: row.retrievability,
    reviewCount: row.reviewCount,
    successfulReviewCount: row.successfulReviewCount,
    consecutiveCorrect: row.consecutiveCorrect,
    lapseCount: row.lapseCount,
    hintCount: row.hintCount,
    lastRating: row.lastRating ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastOpenedAt: iso(row.lastOpenedAt),
    lastReviewedAt: iso(row.lastReviewedAt),
    dueAt: iso(row.dueAt),
    translationStatus: row.translationStatus,
    source: parseJson(row.source, { type: "manual" as const }),
  };
}

export function computeLessonStats(phrases: any[]): LessonStats {
  const total = phrases.length;
  if (total === 0) return { total: 0, due: 0, learning: 0, learned: 0, progress: 0 };
  const now = Date.now();
  let due = 0;
  let learned = 0;
  let progressSum = 0;
  for (const p of phrases) {
    if (p.known) learned += 1;
    if (p.translationStatus === "ready" && p.dueAt && new Date(p.dueAt).getTime() <= now) due += 1;
    progressSum += p.progress;
  }
  const learning = total - learned;
  return {
    total,
    due,
    learning,
    learned,
    progress: Math.round(progressSum / total),
  };
}

export function toLesson(row: any): Lesson {
  return {
    id: row.id,
    title: row.title,
    topicId: row.topicId ?? null,
    topicName: row.topic?.name ?? null,
    archived: row.archived,
    lastOpenedAt: iso(row.lastOpenedAt),
    createdAt: row.createdAt.toISOString(),
    stats: computeLessonStats(row.phrases ?? []),
  };
}

export function toTopic(row: any): Topic {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    lessonCount: row._count?.lessons,
  };
}

export function toExercise(row: any): RuleExercise {
  return {
    id: row.id,
    ruleId: row.ruleId,
    type: row.type,
    prompt: row.prompt,
    answers: parseJson<string[]>(row.answers, []),
    options: parseJson<string[]>(row.options, []),
    explanation: row.explanation,
    position: row.position,
  };
}

export function toRule(row: any): GrammarRule {
  return {
    id: row.id,
    title: row.title,
    query: row.query,
    status: row.status,
    explanation: row.explanation,
    formula: row.formula,
    uses: parseJson<string[]>(row.uses, []),
    examples: parseJson<{ en: string; ru: string }[]>(row.examples, []),
    markers: parseJson<string[]>(row.markers, []),
    mistakes: parseJson<string[]>(row.mistakes, []),
    comparison: row.comparison,
    archived: row.archived,
    progress: row.progress,
    known: row.known,
    difficulty: row.difficulty,
    reviewCount: row.reviewCount,
    consecutiveCorrect: row.consecutiveCorrect,
    dueAt: iso(row.dueAt),
    lastReviewedAt: iso(row.lastReviewedAt),
    createdAt: row.createdAt.toISOString(),
    exercises: (row.exercises ?? []).map(toExercise),
  };
}

export function toSettings(row: any): UserSettings {
  return {
    cardsPerDay: row.cardsPerDay,
    newCardsPerDay: row.newCardsPerDay,
    showFirst: row.showFirst,
    voice: row.voice,
    speechRate: row.speechRate,
    autoPlay: row.autoPlay,
    requiredSuccess: row.requiredSuccess,
    requiredStreak: row.requiredStreak,
    minIntervalDays: row.minIntervalDays,
    countHardAsCorrect: row.countHardAsCorrect,
    progressThreshold: row.progressThreshold,
    animationsEnabled: row.animationsEnabled,
    theme: row.theme ?? "blue",
    lastSection: row.lastSection,
  };
}
