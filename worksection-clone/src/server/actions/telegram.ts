"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { TELEGRAM_BOT_USERNAME, isTelegramConfigured } from "@/server/telegram/api";

// Сгенерировать код и вернуть deep-link для привязки Telegram
export async function connectTelegram(): Promise<{ url: string | null; error: string | null }> {
  const user = await requireUser();
  if (!isTelegramConfigured() || !TELEGRAM_BOT_USERNAME) {
    return { url: null, error: "Telegram-бот не налаштований" };
  }
  const code = randomBytes(8).toString("hex");
  await db.user.update({ where: { id: user.id }, data: { telegramLinkCode: code } });
  return { url: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`, error: null };
}

export async function disconnectTelegram() {
  const user = await requireUser();
  await db.telegramAccount.deleteMany({ where: { userId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { telegramLinkCode: null } });
  revalidatePath("/settings");
}
