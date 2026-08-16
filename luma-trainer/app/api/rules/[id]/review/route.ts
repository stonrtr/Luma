import { db } from "@/lib/db";
import { review, type SrsState } from "@/lib/srs";
import { getSrsSettings } from "@/lib/server/settings";
import { toRule } from "@/lib/serialize";
import { badRequest, json, notFound, readJson } from "@/lib/server/http";
import type { Rating } from "@/lib/types";

const RATINGS: Rating[] = ["again", "hard", "easy"];

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(req);
  const rating = body.rating as Rating;
  if (!RATINGS.includes(rating)) return badRequest("Некорректная оценка");

  const rule = await db.grammarRule.findUnique({ where: { id } });
  if (!rule) return notFound("Правило не найдено");

  const settings = await getSrsSettings();
  const state: SrsState = {
    progress: rule.progress,
    stability: rule.stability,
    difficulty: rule.difficulty,
    reviewCount: rule.reviewCount,
    successfulReviewCount: rule.successfulReviewCount,
    consecutiveCorrect: rule.consecutiveCorrect,
    lapseCount: rule.lapseCount,
    hintCount: 0,
    lastRating: (rule.lastRating as Rating | null) ?? null,
    lastReviewedAt: rule.lastReviewedAt,
    dueAt: rule.dueAt,
  };
  const out = review(state, rating, { settings });

  const updated = await db.grammarRule.update({
    where: { id },
    data: {
      stability: out.stability,
      difficulty: Math.round(out.difficulty),
      retrievability: out.retrievability,
      reviewCount: out.reviewCount,
      successfulReviewCount: out.successfulReviewCount,
      consecutiveCorrect: out.consecutiveCorrect,
      lapseCount: out.lapseCount,
      lastRating: out.lastRating,
      lastReviewedAt: out.lastReviewedAt,
      dueAt: out.dueAt,
      progress: out.progress,
      known: out.known,
    },
    include: { exercises: { orderBy: { position: "asc" } } },
  });

  return json({ rule: toRule(updated), intervalDays: out.intervalDays });
}
