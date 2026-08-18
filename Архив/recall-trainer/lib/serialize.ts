// Map Prisma rows (with JSON-string columns) to the serialized domain types.
import type { Collection, Knowledge, UserSettings } from "./types";

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

export function toKnowledge(row: any): Knowledge {
  return {
    id: row.id,
    title: row.title,
    sourceText: row.sourceText,
    question: row.question,
    keyPoints: parseJson<string[]>(row.keyPoints, []),
    collectionId: row.collectionId ?? null,
    collectionName: row.collection?.name ?? null,
    archived: row.archived,
    genStatus: row.genStatus,
    genError: row.genError ?? "",
    progress: row.progress,
    known: row.known,
    stability: row.stability,
    retrievability: row.retrievability,
    difficulty: row.difficulty,
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
  };
}

export function toCollection(row: any): Collection {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    topicCount: row._count?.topics,
  };
}

export function toSettings(row: any): UserSettings {
  return {
    newCardsPerDay: row.newCardsPerDay,
    cardsPerDay: row.cardsPerDay,
    requiredSuccess: row.requiredSuccess,
    requiredStreak: row.requiredStreak,
    minIntervalDays: row.minIntervalDays,
    countHardAsCorrect: row.countHardAsCorrect,
    progressThreshold: row.progressThreshold,
    animationsEnabled: row.animationsEnabled,
    lastSection: row.lastSection,
  };
}
