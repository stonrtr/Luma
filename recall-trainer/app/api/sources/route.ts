import { db } from "@/lib/db";
import { bad, ok, serverError } from "@/lib/server/http";
import { processSource } from "@/lib/server/process";
import { fetchYoutubeMeta, parseYoutubeId, youtubeWatchUrl } from "@/lib/server/youtube";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      kind?: string;
      url?: string;
      title?: string;
      text?: string;
      type?: string;
    };
    const kind = body.kind ?? "text";

    if (kind === "youtube") {
      const videoId = parseYoutubeId(body.url ?? "");
      if (!videoId) return bad("Не похоже на ссылку YouTube");
      const meta = await fetchYoutubeMeta(videoId);
      const source = await db.source.create({
        data: {
          type: "YOUTUBE",
          title: meta.title,
          author: meta.author,
          url: youtubeWatchUrl(videoId),
          thumbnail: meta.thumbnail,
          duration: meta.duration,
          publishedAt: meta.publishedAt,
          status: "NEW",
        },
      });
      const result = await processSource(source.id);
      if (result.ok) return ok({ sourceId: source.id, draftId: result.draftId });
      return ok({ sourceId: source.id, needTranscript: result.reason === "NEED_TRANSCRIPT", error: result.message });
    }

    // Текст / статья / своя мысль
    const text = (body.text ?? "").trim();
    if (!text) return bad("Пустой текст");
    const title = (body.title ?? "").trim() || text.slice(0, 60);
    const type = body.type === "ARTICLE" ? "ARTICLE" : body.type === "THOUGHT" ? "THOUGHT" : "TEXT";
    const source = await db.source.create({
      data: { type, title, rawContent: text, status: "NEW" },
    });
    const result = await processSource(source.id);
    if (result.ok) return ok({ sourceId: source.id, draftId: result.draftId });
    return ok({ sourceId: source.id, error: result.message });
  } catch (e) {
    return serverError(e);
  }
}
