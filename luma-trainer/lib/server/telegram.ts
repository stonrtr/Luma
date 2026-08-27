// Telegram-бот: присылаешь русскую фразу → бот переводит на английский (через
// тот же LLM, что и Luma) и предлагает добавить карточку в отдельный урок.
// Токен живёт только на сервере (§28). Webhook: POST /api/telegram/webhook.
import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { translatePhrase } from "./translate";
import { estimateDifficulty } from "../difficulty";
import { normalize } from "../lang";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ALLOWED_CHAT = (process.env.TELEGRAM_ALLOWED_CHAT_ID || "").trim();
export const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

// Урок, в который падают карточки из Телеграма.
const LESSON_TITLE = "Из Телеграма";

export function hasTelegram(): boolean {
  return TOKEN.length > 0;
}

function isAllowed(chatId: number | string): boolean {
  if (!ALLOWED_CHAT) return true; // не задан — отвечаем всем (для первичной настройки)
  return String(chatId) === ALLOWED_CHAT;
}

// --- Telegram Bot API ------------------------------------------------------
const API = (method: string) => `https://api.telegram.org/bot${TOKEN}/${method}`;

async function tg(method: string, body: unknown): Promise<void> {
  try {
    await fetch(API(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    /* best-effort */
  }
}

function sendMessage(chatId: number | string, text: string, replyMarkup?: unknown): Promise<void> {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

function answerCallback(id: string, text?: string): Promise<void> {
  return tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
}

function editMessageText(chatId: number | string, messageId: number, text: string): Promise<void> {
  return tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

/** Зарегистрировать webhook (server-side, токен не покидает сервер). */
export async function setWebhook(url: string): Promise<{ ok: boolean; description?: string }> {
  try {
    const res = await fetch(API("setWebhook"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        allowed_updates: ["message", "callback_query"],
        ...(WEBHOOK_SECRET ? { secret_token: WEBHOOK_SECRET } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const j = (await res.json()) as { ok: boolean; description?: string };
    return j;
  } catch (e) {
    return { ok: false, description: (e as Error).message };
  }
}

// --- Ожидающие подтверждения переводы (в памяти, короткоживущие) -----------
type Pending = {
  russian: string;
  english: string;
  transcription: string;
  exampleEn: string;
  exampleRu: string;
  difficulty: number;
  alternatives: string[];
  expires: number;
};
const pending = new Map<string, Pending>();
const PENDING_TTL_MS = 30 * 60 * 1000;

function putPending(p: Omit<Pending, "expires">): string {
  const token = randomUUID().slice(0, 8);
  pending.set(token, { ...p, expires: Date.now() + PENDING_TTL_MS });
  // Чистим протухшие.
  const now = Date.now();
  for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
  return token;
}

// --- Обработка апдейтов -----------------------------------------------------
type TgUpdate = {
  message?: { chat: { id: number }; text?: string; from?: { id: number } };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
    from?: { id: number };
  };
};

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message) return handleMessage(update.message);
}

async function handleMessage(msg: NonNullable<TgUpdate["message"]>): Promise<void> {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  if (!text) return;

  // Команды и первичная настройка.
  if (text === "/start" || text === "/help" || text === "/id") {
    const idNote = ALLOWED_CHAT
      ? ""
      : `\n\nТвой chat id: <code>${chatId}</code>\nВпиши его в переменную <b>TELEGRAM_ALLOWED_CHAT_ID</b> на сервере, чтобы бот отвечал только тебе.`;
    await sendMessage(
      chatId,
      `Привет! Пришли мне фразу на русском — я переведу её на английский и предложу добавить в Luma (урок «${LESSON_TITLE}»).${idNote}`
    );
    return;
  }

  if (!isAllowed(chatId)) {
    await sendMessage(chatId, "Этот бот приватный.");
    return;
  }

  await sendMessage(chatId, "🔁 Перевожу…");

  try {
    const result = await translatePhrase({ russian: text, sourceLanguage: "ru" });
    const english = normalize(result.english || result.translations[0] || "");
    if (!english) {
      await sendMessage(chatId, "Не удалось перевести. Попробуй переформулировать.");
      return;
    }
    const alternatives = result.translations.filter((t) => t && t !== english).slice(0, 4);
    const difficulty = result.difficulty || estimateDifficulty(english);

    const token = putPending({
      russian: text,
      english,
      transcription: result.transcription || "",
      exampleEn: result.exampleEn || "",
      exampleRu: result.exampleRu || "",
      difficulty,
      alternatives,
    });

    // Красивый ответ.
    let body = `🇷🇺 ${escapeHtml(text)}\n🇬🇧 <b>${escapeHtml(english)}</b>`;
    if (result.transcription) body += `\n<code>${escapeHtml(result.transcription)}</code>`;
    if (alternatives.length) body += `\n\nЕщё варианты: ${alternatives.map(escapeHtml).join(", ")}`;
    if (result.exampleEn) {
      body += `\n\n<i>${escapeHtml(result.exampleEn)}</i>`;
      if (result.exampleRu) body += `\n<i>${escapeHtml(result.exampleRu)}</i>`;
    }
    body += `\n\nДобавить в Luma?`;

    await sendMessage(chatId, body, {
      inline_keyboard: [
        [
          { text: "✅ Добавить", callback_data: `add:${token}` },
          { text: "✖️ Нет", callback_data: `skip:${token}` },
        ],
      ],
    });
  } catch {
    await sendMessage(chatId, "⚠️ Перевод временно недоступен (лимит или сеть). Попробуй ещё раз.");
  }
}

async function handleCallback(cb: NonNullable<TgUpdate["callback_query"]>): Promise<void> {
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  const data = cb.data || "";
  if (chatId === undefined || messageId === undefined) {
    await answerCallback(cb.id);
    return;
  }
  if (!isAllowed(chatId)) {
    await answerCallback(cb.id, "Приватный бот");
    return;
  }

  const [action, token] = data.split(":");
  const item = token ? pending.get(token) : undefined;

  if (action === "skip") {
    if (token) pending.delete(token);
    await answerCallback(cb.id, "Пропущено");
    await editMessageText(chatId, messageId, "✖️ Пропущено.");
    return;
  }

  if (action === "add") {
    if (!item || item.expires < Date.now()) {
      await answerCallback(cb.id, "Устарело");
      await editMessageText(chatId, messageId, "⌛ Срок истёк — пришли фразу заново.");
      return;
    }
    pending.delete(token);
    try {
      const lessonId = await ensureLesson();
      await db.phraseCard.create({
        data: {
          lessonId,
          english: item.english,
          russian: item.russian,
          alternativeTranslations: JSON.stringify(item.alternatives),
          transcription: item.transcription,
          exampleEn: item.exampleEn,
          exampleRu: item.exampleRu,
          difficulty: item.difficulty,
          translationStatus: "ready",
          dueAt: new Date(),
          source: JSON.stringify({ type: "telegram" }),
        },
      });
      await answerCallback(cb.id, "Добавлено ✅");
      await editMessageText(
        chatId,
        messageId,
        `✅ Добавлено в «${LESSON_TITLE}»:\n🇬🇧 <b>${escapeHtml(item.english)}</b> — 🇷🇺 ${escapeHtml(item.russian)}`
      );
    } catch {
      await answerCallback(cb.id, "Ошибка");
      await editMessageText(chatId, messageId, "⚠️ Не удалось сохранить. Попробуй позже.");
    }
    return;
  }

  await answerCallback(cb.id);
}

/** Найти или создать урок «Из Телеграма». */
async function ensureLesson(): Promise<string> {
  const existing = await db.lesson.findFirst({
    where: { title: LESSON_TITLE, archived: false },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;
  const created = await db.lesson.create({ data: { title: LESSON_TITLE } });
  return created.id;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
