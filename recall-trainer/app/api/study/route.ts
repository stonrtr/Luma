import { db } from "@/lib/db";
import { json } from "@/lib/server/http";
import { toKnowledge } from "@/lib/serialize";
import { getSettingsRow } from "@/lib/server/settings";
import { localDayKey } from "@/lib/date";

const INCLUDE = { collection: true } as const;

// GET /api/study?scope=today|all|collection&collectionId=
// Returns the ordered queue of topics to review now.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "today";
  const collectionId = url.searchParams.get("collectionId");
  const now = new Date();

  // Only studiable topics: not archived, with a question composed.
  const base = { archived: false, question: { not: "" } };

  if (scope === "all" || scope === "collection") {
    const where: Record<string, unknown> = { ...base };
    if (scope === "collection" && collectionId) {
      where.collectionId = collectionId === "none" ? null : collectionId;
    }
    const rows = await db.knowledge.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      include: INCLUDE,
    });
    return json({ scope, cards: rows.map(toKnowledge) });
  }

  // scope === "today"
  const settings = await getSettingsRow();
  const today = await db.dailyActivity.findUnique({ where: { date: localDayKey(now) } });
  const newAllowance = Math.max(0, settings.newCardsPerDay - (today?.newStudied ?? 0));

  const due = await db.knowledge.findMany({
    where: { ...base, reviewCount: { gt: 0 }, dueAt: { lte: now } },
    orderBy: [{ dueAt: "asc" }],
    include: INCLUDE,
  });

  const fresh = await db.knowledge.findMany({
    where: { ...base, reviewCount: 0 },
    orderBy: [{ createdAt: "asc" }],
    take: newAllowance,
    include: INCLUDE,
  });

  const combined = [...due, ...fresh].slice(0, settings.cardsPerDay);
  return json({ scope, cards: combined.map(toKnowledge) });
}
