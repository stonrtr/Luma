import { db } from "@/lib/db";
import { translateCard } from "@/lib/server/translateWorker";
import { json } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

// Rebuild translations for a lesson (§11.4 "пересобрать переводы"). Runs in background.
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const cards = await db.phraseCard.findMany({ where: { lessonId: id }, select: { id: true } });
  await db.phraseCard.updateMany({ where: { lessonId: id }, data: { translationStatus: "pending" } });

  void (async () => {
    for (const c of cards) await translateCard(c.id);
  })();

  return json({ ok: true, queued: cards.length });
}
