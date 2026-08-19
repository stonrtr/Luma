import { bad, ok, serverError } from "@/lib/server/http";
import { hasAnyLLM } from "@/lib/server/llm";
import { suggestMeta } from "@/lib/server/ai-features";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!hasAnyLLM()) return bad("AI не настроен (нет ключа)", 503);
    const body = (await req.json()) as { title?: string; content?: string };
    const content = (body.content ?? "").trim();
    if (!content) return bad("Пустой текст");
    const result = await suggestMeta((body.title ?? "").trim(), content);
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
