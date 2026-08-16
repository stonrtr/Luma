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

export interface SrsState {
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
 * Progress (§9.5): not just "recall probability now". Blends successful reps,
 * streak length, achieved interval, and the last answer; then softly penalizes
 * lapses and hint use. New cards are always 0. "again" can never yield 100.
 */
export function computeProgress(
  state: Pick<
    SrsState,
    | "reviewCount"
    | "successfulReviewCount"
    | "consecutiveCorrect"
    | "stability"
    | "lapseCount"
    | "hintCount"
    | "lastRating"
  >,
  settings: SrsSettings
): { progress: number; known: boolean } {
  if (state.reviewCount === 0) return { progress: 0, known: false };

  const repScore = clamp(state.successfulReviewCount / Math.max(1, settings.requiredSuccess), 0, 1);
  const streakScore = clamp(state.consecutiveCorrect / Math.max(1, settings.requiredStreak), 0, 1);
  const intervalScore = clamp(state.stability / Math.max(0.01, settings.minIntervalDays), 0, 1);
  const lastGood = state.lastRating && state.lastRating !== "again" ? 1 : 0;

  // Штрафы «прощаются» серией правильных ответов: сразу после провала прогресс
  // проседает, но каждая ступень серии гасит один старый провал/подсказку.
  // Иначе одна ошибка навсегда запирала карточку ниже 100% («выучено»
  // становилось недостижимым — вечный потолок 95%).
  const effLapses = Math.max(0, state.lapseCount - state.consecutiveCorrect);
  const effHints = Math.max(0, state.hintCount - state.consecutiveCorrect);
  const errorPenalty = Math.max(0.85, 1 - effLapses * 0.05);
  const hintPenalty = Math.max(0.8, 1 - effHints * 0.03);

  const base = 0.3 * repScore + 0.25 * streakScore + 0.35 * intervalScore + 0.1 * lastGood;
  const computed = base * errorPenalty * hintPenalty * 100;

  const metCriteria =
    state.successfulReviewCount >= settings.requiredSuccess &&
    state.consecutiveCorrect >= settings.requiredStreak &&
    state.stability >= settings.minIntervalDays &&
    state.lastRating !== "again";

  const known = metCriteria && computed >= settings.progressThreshold;
  const progress = known ? 100 : Math.round(clamp(computed, 0, 99));
  return { progress, known };
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
  const settings = opts.settings ?? DEFAULT_SRS_SETTINGS;
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
    const countsSuccess = rating === "easy" || settings.countHardAsCorrect;
    if (countsSuccess) successfulReviewCount += 1;

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

  const progressInput = {
    reviewCount,
    successfulReviewCount,
    consecutiveCorrect,
    stability,
    lapseCount,
    hintCount: state.hintCount,
    lastRating: rating,
  };
  const { progress, known } = computeProgress(progressInput, settings);

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
