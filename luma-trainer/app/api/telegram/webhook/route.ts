import { json } from "@/lib/server/http";
import { handleUpdate, hasTelegram, setWebhook, WEBHOOK_SECRET } from "@/lib/server/telegram";

// Telegram шлёт апдейты сюда. Проверяем секрет-заголовок (если задан).
export async function POST(req: Request) {
  if (!hasTelegram()) return json({ ok: false, error: "telegram-not-configured" }, { status: 503 });

  if (WEBHOOK_SECRET) {
    const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
    if (got !== WEBHOOK_SECRET) return json({ ok: false }, { status: 401 });
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return json({ ok: true }); // молча подтверждаем — не заставляем Telegram ретраить
  }

  // Обрабатываем не блокируя ответ (Telegram ждёт быстрый 200).
  try {
    await handleUpdate(update as never);
  } catch {
    /* ошибки уже гасятся внутри */
  }
  return json({ ok: true });
}

// GET ?key=<secret> → разово зарегистрировать webhook на этот адрес.
export async function GET(req: Request) {
  if (!hasTelegram()) return json({ ok: false, error: "telegram-not-configured" }, { status: 503 });

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  if (WEBHOOK_SECRET && key !== WEBHOOK_SECRET) {
    return json({ ok: false, error: "bad-key" }, { status: 401 });
  }

  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const webhookUrl = `${proto}://${host}/api/telegram/webhook`;

  const result = await setWebhook(webhookUrl);
  return json({ ok: result.ok, webhookUrl, description: result.description });
}
