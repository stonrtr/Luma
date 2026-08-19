import { bad, ok, serverError } from "@/lib/server/http";
import { hasAnyLLM } from "@/lib/server/llm";
import { runQuickAction, type QuickAction } from "@/lib/server/ai-features";

const ACTIONS: QuickAction[] = ["shorten", "expand", "simplify", "restructure", "highlight", "bulletize"];

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!hasAnyLLM()) return bad("AI не настроен (нет ключа)", 503);
    const body = (await req.json()) as { text?: string; action?: string };
    const text = (body.text ?? "").trim();
    if (!text) return bad("Пустой текст");
    if (!ACTIONS.includes(body.action as QuickAction)) return bad("Неизвестное действие");
    const result = await runQuickAction(body.action as QuickAction, text);
    return ok({ result });
  } catch (e) {
    return serverError(e);
  }
}
