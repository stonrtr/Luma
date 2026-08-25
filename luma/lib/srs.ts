// Spaced repetition (FSRS-like) — spec §9.
// A compact, principled stability/difficulty model with retrievability decay.
// Three ratings map to the spec's three buttons:
//   again = "Не вспомнил", hard = "С трудом", easy = "Легко".

import type { Rating } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_DAYS = 1 / (24 * 60);
const AGAIN_DELAY_DAYS = 10 * MINUTE_DAYS; // ~10 minutes (§9.2)
// Потолок интервала: без него после 5–6 «Легко» карточка уходила на годы.
const MAX_STABILITY_DAYS = 365;

// Балльный прогресс: нужно набрать 100 очков, чтобы слово стало «выучено».
export const LEARNED_POINTS = 100;
export const EASY_POINTS = 25;
export const HARD_POINTS = 15;

export interface SrsState {
  progress: number; // накопленные баллы 0..100
  stability: number; // days of memory strength
  difficulty: number; // 1..10 (intrinsic phrase difficulty, drifts slightly)
  reviewCount: number;
  successfulReviewCount: number;
  consecutiveCorrect: number; // streak without "again"
  lapseCount: number;
  hintCount: number;
  lastRating: Rating | null;
  lastReviewedAt: Date | null;
  dueAt: Date | null;
}

export interface SrsSettings {
  countHardAsCorrect: boolean;
  requiredSuccess: number;
  requiredStreak: number;
  minIntervalDays: number;
  progressThreshold: number; // 0..100
}

export const DEFAULT_SRS_SETTINGS: SrsSettings = {
  countHardAsCorrect: true,
  requiredSuccess: 4,
  requiredStreak: 3,
  minIntervalDays: 7,
  progressThreshold: 100,
};

export interface ReviewOutcome {
  stability: number;
  difficulty: number;
  retrievability: number;
  reviewCount: number;
  successfulReviewCount: number;
  consecutiveCorrect: number;
  lapseCount: number;
  lastRating: Rating;
  lastReviewedAt: Date;
  dueAt: Date;
  intervalDays: number;
  progress: number;
  known: boolean;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Recall probability right now, given elapsed time since last review. 0 for brand-new. */
export function retrievability(state: SrsState, now: Date = new Date()): number {
  if (!state.lastReviewedAt || state.stability <= 0) return 0;
  const elapsedDays = (now.getTime() - state.lastReviewedAt.getTime()) / DAY_MS;
  return Math.exp(-Math.max(0, elapsedDays) / state.stability);
}

/**
 * Прогресс слова — простая линейная логика:
 * Балльная система: нужно набрать 100 очков. «Легко» +25, «С трудом» +15,
 * «Не вспомнил» (и подсказка) обнуляют прогресс до 0. 100 очков = «выучено».
 * Это НЕ про интервал в днях: расписание считается отдельно (см. review).
 */

/** Очки за оценку. «again» обрабатывается отдельно (обнуление). */
export function pointsFor(rating: Rating): number {
  return rating === "easy" ? EASY_POINTS : rating === "hard" ? HARD_POINTS : 0;
}

/** Новый прогресс из предыдущего и оценки. */
export function nextProgress(prev: number, rating: Rating): number {
  if (rating === "again") return 0;
  return clamp(prev + pointsFor(rating), 0, LEARNED_POINTS);
}

/**
 * Apply one review and return the full next state.
 * Подсказка приравнивается к «Не вспомнил»: если открывал буквы — сам не
 * вспомнил, и любая оценка обрабатывается как again (решение пользователя,
 * заменяет мягкий штраф из §7.5 ТЗ).
 */
export function review(
  state: SrsState,
  rating: Rating,
  opts: { now?: Date; usedHint?: boolean; settings?: SrsSettings } = {}
): ReviewOutcome {
  const now = opts.now ?? new Date();
  const usedHint = opts.usedHint ?? false;
  if (usedHint) rating = "again";

  const rNow = retrievability(state, now);
  const reviewCount = state.reviewCount + 1;
  const isNew = state.stability <= 0 || !state.lastReviewedAt;

  let stability: number;
  let difficulty = state.difficulty;
  let consecutiveCorrect: number;
  let successfulReviewCount = state.successfulReviewCount;
  let lapseCount = state.lapseCount;
  let intervalDays: number;

  if (rating === "again") {
    lapseCount += 1;
    consecutiveCorrect = 0;
    difficulty = clamp(difficulty + 1, 1, 10);
    stability = Math.max(AGAIN_DELAY_DAYS, state.stability * 0.2);
    intervalDays = AGAIN_DELAY_DAYS; // reschedule in ~10 min (§9.2)
  } else {
    consecutiveCorrect = state.consecutiveCorrect + 1;
    successfulReviewCount += 1;

    // Easy eases difficulty a touch; hard nudges it up slightly (§9.2).
    difficulty =
      rating === "easy" ? clamp(difficulty - 0.3, 1, 10) : clamp(difficulty + 0.1, 1, 10);

    // Harder phrases grow slower; recalling at low retrievability grows faster (FSRS spirit).
    const diffFactor = 1 - (difficulty - 1) / 18; // d=1 → 1.0, d=10 → 0.5
    const rBoost = 1 + (1 - rNow) * 0.6;
    const targetMul = rating === "easy" ? 3.0 : 1.4;
    const mul = 1 + (targetMul - 1) * diffFactor * rBoost;

    if (isNew) {
      const seed = rating === "easy" ? 4 : 1;
      stability = Math.max(rating === "easy" ? 2 : 0.5, seed * diffFactor);
    } else {
      stability = state.stability * mul;
    }
    stability = Math.min(stability, MAX_STABILITY_DAYS);
    intervalDays = stability;
  }

  const dueAt = new Date(now.getTime() + intervalDays * DAY_MS);

  // Балльный прогресс: +25 / +15 / обнуление.
  const progress = nextProgress(state.progress, rating);
  const known = progress >= LEARNED_POINTS;

  return {
    stability,
    difficulty,
    retrievability: rNow,
    reviewCount,
    successfulReviewCount,
    consecutiveCorrect,
    lapseCount,
    lastRating: rating,
    lastReviewedAt: now,
    dueAt,
    intervalDays,
    progress,
    known,
  };
}
