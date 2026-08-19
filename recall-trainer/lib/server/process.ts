// Конвейер обработки источника: RAW → AI-черновик (§38). Переиспользуется
// при создании источника и при «Пересобрать черновик».
import "server-only";
import { db } from "@/lib/db";
import { jsonSegments } from "@/lib/db-mappers";
import { analyzeText, analyzeYoutube, type PipelineBlock } from "./pipeline";
import { fetchTranscript, parseYoutubeId } from "./youtube";

async function setStatus(id: string, status: string, error?: string | null) {
  await db.source.update({ where: { id }, data: { status, error: error ?? null } });
}

async function writeDraft(sourceId: string, blocks: PipelineBlock[]) {
  // Удаляем прошлый черновик (пересборка), затем пишем новый.
  await db.draft.deleteMany({ where: { sourceId } });
  const draft = await db.draft.create({ data: { sourceId } });
  await db.draftBlock.createMany({
    data: blocks.map((b, i) => ({
      draftId: draft.id,
      title: b.title,
      summary: b.summary,
      content: b.content,
      keyPoints: JSON.stringify(b.keyPoints),
      terms: JSON.stringify(b.terms),
      examples: JSON.stringify(b.examples),
      takeaways: JSON.stringify(b.takeaways),
      startTimestamp: b.start,
      endTimestamp: b.end,
      suggestedTopic: b.suggestedTopic,
      order: i,
    })),
  });
  return draft.id;
}

export type ProcessResult =
  | { ok: true; draftId: string }
  | { ok: false; reason: "NEED_TRANSCRIPT" | "ERROR"; message: string };

export async function processSource(sourceId: string): Promise<ProcessResult> {
  const s = await db.source.findUnique({ where: { id: sourceId } });
  if (!s) return { ok: false, reason: "ERROR", message: "Источник не найден" };

  try {
    let segments = jsonSegments(s.segments);
    let raw = s.rawContent ?? "";

    if (s.type === "YOUTUBE" && !segments.length && !raw) {
      await setStatus(sourceId, "TRANSCRIBING");
      const vid = s.url ? parseYoutubeId(s.url) : null;
      if (vid) {
        const segs = await fetchTranscript(vid);
        if (segs.length) {
          segments = segs;
          raw = segs.map((x) => x.text).join(" ");
          await db.source.update({
            where: { id: sourceId },
            data: { segments: JSON.stringify(segs), rawContent: raw },
          });
        }
      }
      if (!segments.length && !raw) {
        await setStatus(
          sourceId,
          "ERROR",
          "Субтитры не найдены. Вставьте транскрипт вручную и пересоберите черновик."
        );
        return {
          ok: false,
          reason: "NEED_TRANSCRIPT",
          message: "Субтитры не найдены — вставьте транскрипт вручную.",
        };
      }
    }

    if (!raw && !segments.length) {
      await setStatus(sourceId, "ERROR", "Нет содержимого для анализа.");
      return { ok: false, reason: "ERROR", message: "Нет содержимого для анализа." };
    }

    await setStatus(sourceId, "ANALYZING");
    const analysis = segments.length
      ? await analyzeYoutube({ title: s.title, author: s.author }, segments)
      : await analyzeText(s.title, raw);

    const draftId = await writeDraft(sourceId, analysis.blocks);
    await db.source.update({
      where: { id: sourceId },
      data: { status: "DRAFT_READY", language: analysis.language || s.language, error: null },
    });
    return { ok: true, draftId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка обработки";
    await setStatus(sourceId, "ERROR", message.slice(0, 300));
    return { ok: false, reason: "ERROR", message };
  }
}
