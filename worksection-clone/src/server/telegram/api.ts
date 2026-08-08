import "server-only";
import { db } from "@/server/db";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
export const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "";

export function isTelegramConfigured(): boolean {
  return !!TOKEN;
}

// Отправить сообщение в конкретный чат Telegram (extra — доп. поля, напр. reply_markup)
export async function sendTelegram(chatId: string, text: string, extra?: Record<string, unknown>): Promise<boolean> {
  if (!TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Отправить сообщение пользователю приложения (если он привязал Telegram)
export async function sendTelegramToUser(userId: string, text: string): Promise<void> {
  if (!TOKEN) return;
  const acc = await db.telegramAccount.findUnique({ where: { userId }, select: { chatId: true } });
  if (!acc) return;
  await sendTelegram(acc.chatId, text);
}
