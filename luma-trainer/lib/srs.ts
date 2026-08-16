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
 * Прогресс слова — простая линейная логика:
 *   прогресс = (правильных ответов подряд) / (нужно для «выучено») × 100.
 * Каждый верный ответ («Легко», а также «С трудом» если он засчитывается)
 * добавляет одну равную долю. «Не вспомнил» и подсказка обнуляют серию → 0%.
 * Дойдя до нужного числа подряд — 100% и статус «выучено».
 * Это НЕ про интервал в днях: расписание считается отдельно (см. review).
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
  const target = Math.max(1, settings.requiredSuccess);
  const ratio = state.consecutiveCorrect / target;
  const known = ratio >= 1;
  const progress = known ? 100 : Math.round(clamp(ratio, 0, 1) * 100);
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
    // «С трудом» продвигает полоску, только если засчитывается как правильный.
    const countsSuccess = rating === "easy" || settings.countHardAsCorrect;
    consecutiveCorrect = countsSuccess ? state.consecutiveCorrect + 1 : state.consecutiveCorrect;
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
