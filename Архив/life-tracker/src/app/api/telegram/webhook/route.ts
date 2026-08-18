import { handleTelegramUpdate } from "@/server/telegram/commands";
import { isTelegramConfigured } from "@/server/telegram/api";

export const dynamic = "force-dynamic";

// Приёмник апдейтов от Telegram. При регистрации вебхука задайте secret_token,
// Telegram будет слать его в заголовке X-Telegram-Bot-Api-Secret-Token.
export async function POST(request: Request) {
  if (!isTelegramConfigured()) return Response.json({ ok: false }, { status: 503 });

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const update = await request.json();
    await handleTelegramUpdate(update);
  } catch {
    // не даём Telegram ретраить бесконечно
  }
  return Response.json({ ok: true });
}
